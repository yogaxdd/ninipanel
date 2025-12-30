/**
 * Docker Container Manager
 * Manages VPS containers using Docker
 */

const Docker = require('dockerode');

// Connect to Docker
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

// Container image (using Node.js Alpine for bot hosting)
const DEFAULT_IMAGE = 'node:18-alpine';

// Plan to Docker resource limits (memory in bytes, cpuQuota in microseconds per 100ms)
const PLAN_LIMITS = {
    starter: { memory: 20 * 1024 * 1024, cpuQuota: 10000 },        // 20MB, 10% CPU
    basic: { memory: 50 * 1024 * 1024, cpuQuota: 25000 },          // 50MB, 25% CPU
    standard: { memory: 100 * 1024 * 1024, cpuQuota: 50000 },      // 100MB, 50% CPU
    premium: { memory: 200 * 1024 * 1024, cpuQuota: 100000 },      // 200MB, 100% CPU
    superpremium: { memory: 500 * 1024 * 1024, cpuQuota: 200000 }  // 500MB, 200% CPU (4 cores)
};

// Get limits for custom plan
function getCustomLimits(ram, cpu) {
    return {
        memory: (ram || 100) * 1024 * 1024,
        cpuQuota: Math.min((cpu || 1) * 50000, 400000) // Max 4 CPUs
    };
}

class ContainerManager {
    // Check if Docker is available
    async isAvailable() {
        try {
            await docker.ping();
            return true;
        } catch (err) {
            console.error('Docker not available:', err.message);
            return false;
        }
    }

    // Pull image if not exists
    async ensureImage(image = DEFAULT_IMAGE) {
        try {
            await docker.getImage(image).inspect();
        } catch (err) {
            console.log(`Pulling image ${image}...`);
            await new Promise((resolve, reject) => {
                docker.pull(image, (err, stream) => {
                    if (err) return reject(err);
                    docker.modem.followProgress(stream, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        }
    }

    // Create new container
    async createContainer(serverId, plan, serverName, customRam = null, customDisk = null) {
        // Get limits based on plan or custom values
        let limits;
        if (plan === 'custom' && customRam) {
            const cpu = Math.ceil(customRam / 100);
            limits = getCustomLimits(customRam, cpu);
        } else {
            limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
        }

        await this.ensureImage();

        // Calculate disk limit (in bytes)
        const diskLimit = (customDisk || 500) * 1024 * 1024;

        const container = await docker.createContainer({
            name: `ninipanel-${serverId}`,
            Image: DEFAULT_IMAGE,
            Cmd: ['sh', '-c', 'cd /home/container && tail -f /dev/null'],
            WorkingDir: '/home/container',
            Tty: true,
            OpenStdin: true,
            Labels: {
                'ninipanel.id': serverId,
                'ninipanel.name': serverName,
                'ninipanel.plan': plan
            },
            HostConfig: {
                Memory: limits.memory,
                MemorySwap: limits.memory, // No swap
                CpuQuota: limits.cpuQuota,
                CpuPeriod: 100000,
                RestartPolicy: { Name: 'unless-stopped' },
                // Storage limit via tmpfs (optional)
                Tmpfs: {
                    '/tmp': `size=${Math.floor(diskLimit / 10)}`
                }
            }
        });

        // Create working directory and set permissions
        await container.start();
        const docker2 = this.getDocker();
        const exec = await container.exec({
            Cmd: ['sh', '-c', 'mkdir -p /home/container && chmod 777 /home/container'],
            AttachStdout: true,
            AttachStderr: true
        });
        await exec.start();

        return container.id;
    }

    // Start container
    async startContainer(containerId) {
        try {
            const container = docker.getContainer(containerId);
            await container.start();
            return true;
        } catch (err) {
            if (err.statusCode === 304) return true; // Already started
            throw err;
        }
    }

    // Stop container
    async stopContainer(containerId) {
        try {
            const container = docker.getContainer(containerId);
            await container.stop({ t: 10 });
            return true;
        } catch (err) {
            if (err.statusCode === 304) return true; // Already stopped
            throw err;
        }
    }

    // Restart container
    async restartContainer(containerId) {
        const container = docker.getContainer(containerId);
        await container.restart({ t: 5 });
        return true;
    }

    // Delete container
    async deleteContainer(containerId) {
        try {
            const container = docker.getContainer(containerId);
            await container.stop({ t: 5 }).catch(() => { });
            await container.remove({ force: true });
            return true;
        } catch (err) {
            console.error('Error deleting container:', err.message);
            return false;
        }
    }

    // Get container status
    async getContainerStatus(containerId) {
        try {
            const container = docker.getContainer(containerId);
            const info = await container.inspect();
            return {
                running: info.State.Running,
                status: info.State.Status,
                startedAt: info.State.StartedAt,
                pid: info.State.Pid
            };
        } catch (err) {
            return { running: false, status: 'not_found' };
        }
    }

    // Get container stats
    async getContainerStats(containerId) {
        try {
            const container = docker.getContainer(containerId);
            const stats = await container.stats({ stream: false });

            // Calculate CPU percentage
            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
            const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
            const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

            // Calculate memory percentage
            const memUsed = stats.memory_stats.usage;
            const memLimit = stats.memory_stats.limit;
            const memPercent = (memUsed / memLimit) * 100;

            return {
                cpu: Math.round(cpuPercent * 100) / 100,
                memory: {
                    used: memUsed,
                    limit: memLimit,
                    percent: Math.round(memPercent * 100) / 100
                }
            };
        } catch (err) {
            return { cpu: 0, memory: { used: 0, limit: 0, percent: 0 } };
        }
    }

    // Execute command in container
    async exec(containerId, command) {
        const container = docker.getContainer(containerId);

        const exec = await container.exec({
            Cmd: ['sh', '-c', command],
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await exec.start({ hijack: true, stdin: true });

        return new Promise((resolve) => {
            let output = '';
            stream.on('data', (chunk) => {
                output += chunk.toString();
            });
            stream.on('end', () => {
                resolve(output.replace(/[\x00-\x08]/g, '').trim());
            });
        });
    }

    // List files in container
    async listFiles(containerId, path = '/') {
        const output = await this.exec(containerId, `ls -la "${path}" 2>/dev/null || echo "[]"`);

        const files = [];
        const lines = output.split('\n').filter(l => l && !l.startsWith('total'));

        for (const line of lines) {
            const parts = line.split(/\s+/);
            if (parts.length >= 9) {
                const permissions = parts[0];
                const size = parts[4];
                const date = `${parts[5]} ${parts[6]} ${parts[7]}`;
                const name = parts.slice(8).join(' ');

                if (name !== '.' && name !== '..') {
                    files.push({
                        name,
                        type: permissions.startsWith('d') ? 'directory' : 'file',
                        permissions,
                        size,
                        modified: date
                    });
                }
            }
        }

        return files;
    }

    // Create backup of container files
    async createBackup(containerId, backupPath) {
        const container = docker.getContainer(containerId);
        const fs = require('fs');

        try {
            // Get container archive
            const stream = await container.getArchive({ path: '/home/container' });
            const writeStream = fs.createWriteStream(backupPath);

            return new Promise((resolve, reject) => {
                stream.pipe(writeStream);
                writeStream.on('finish', () => {
                    const stats = fs.statSync(backupPath);
                    resolve(stats.size);
                });
                writeStream.on('error', reject);
            });
        } catch (err) {
            console.error('Backup error:', err.message);
            throw err;
        }
    }

    // Restore backup to container
    async restoreBackup(containerId, backupPath) {
        const container = docker.getContainer(containerId);
        const fs = require('fs');

        try {
            const readStream = fs.createReadStream(backupPath);
            await container.putArchive(readStream, { path: '/home/container' });
            return true;
        } catch (err) {
            console.error('Restore error:', err.message);
            throw err;
        }
    }

    // Get Docker instance
    getDocker() {
        return docker;
    }
}

module.exports = new ContainerManager();
