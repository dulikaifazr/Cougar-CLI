/**
 * Common Unix Commands Database
 * 
 * A curated list of 500+ most frequently used Unix/Linux commands
 * for developers and system administrators.
 * 
 * Categories:
 * - File & Directory Operations
 * - Text Processing
 * - Process Management
 * - Network Tools
 * - Development Tools
 * - System Administration
 * - Package Management
 * - Version Control
 */

export const COMMON_UNIX_COMMANDS = [
  // File & Directory Operations (50+)
  'ls', 'cd', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'touch', 'cat',
  'less', 'more', 'head', 'tail', 'file', 'stat', 'ln', 'readlink', 'basename', 'dirname',
  'find', 'locate', 'which', 'whereis', 'type', 'tree', 'du', 'df', 'mount', 'umount',
  'chmod', 'chown', 'chgrp', 'umask', 'setfacl', 'getfacl', 'lsattr', 'chattr', 'realpath', 'mktemp',
  'rsync', 'scp', 'sftp', 'ftp', 'wget', 'curl', 'tar', 'gzip', 'gunzip', 'zip',
  'unzip', 'bzip2', 'bunzip2', 'xz', 'unxz', '7z', 'rar', 'unrar', 'zcat', 'zless',
  
  // Text Processing (50+)
  'grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'sed', 'awk', 'cut', 'paste',
  'sort', 'uniq', 'wc', 'tr', 'col', 'column', 'expand', 'unexpand', 'fold', 'fmt',
  'pr', 'nl', 'od', 'hexdump', 'xxd', 'strings', 'split', 'csplit', 'join', 'comm',
  'diff', 'sdiff', 'vimdiff', 'patch', 'diffstat', 'cmp', 'md5sum', 'sha1sum', 'sha256sum', 'sha512sum',
  'base64', 'uuencode', 'uudecode', 'rev', 'tac', 'shuf', 'jq', 'yq', 'xmllint', 'tidy',
  
  // Process Management (40+)
  'ps', 'top', 'htop', 'atop', 'iotop', 'iftop', 'nethogs', 'pgrep', 'pkill', 'kill',
  'killall', 'jobs', 'bg', 'fg', 'nohup', 'disown', 'nice', 'renice', 'ionice', 'taskset',
  'pstree', 'fuser', 'lsof', 'strace', 'ltrace', 'ptrace', 'gdb', 'valgrind', 'time', 'timeout',
  'watch', 'screen', 'tmux', 'byobu', 'dtach', 'nmon', 'dstat', 'vmstat', 'iostat', 'mpstat',
  
  // Network Tools (50+)
  'ping', 'ping6', 'traceroute', 'tracepath', 'mtr', 'netstat', 'ss', 'ip', 'ifconfig', 'route',
  'arp', 'hostname', 'hostnamectl', 'nslookup', 'dig', 'host', 'whois', 'nc', 'netcat', 'ncat',
  'socat', 'telnet', 'ssh', 'ssh-keygen', 'ssh-copy-id', 'ssh-add', 'ssh-agent', 'sshd', 'tcpdump', 'wireshark',
  'tshark', 'nmap', 'masscan', 'zmap', 'iptables', 'ip6tables', 'firewall-cmd', 'ufw', 'fail2ban', 'nginx',
  'apache2', 'httpd', 'curl', 'wget', 'aria2', 'axel', 'links', 'lynx', 'w3m', 'elinks',
  
  // Development Tools - Languages (60+)
  'gcc', 'g++', 'clang', 'clang++', 'make', 'cmake', 'autoconf', 'automake', 'libtool', 'pkg-config',
  'python3', 'pip', 'pip3', 'pipenv', 'poetry', 'virtualenv', 'pyenv',
  'node', 'npm', 'uv', 'npx', 'yarn', 'pnpm', 'nvm', 'volta', 'deno', 'bun', 'tsx',
  'ruby', 'gem', 'bundle', 'bundler', 'rake', 'rbenv', 'rvm', 'irb', 'pry', 'rails',
  'java', 'javac', 'jar', 'javadoc', 'maven', 'mvn', 'gradle', 'ant', 'kotlin', 'kotlinc',
  'go', 'gofmt', 'golint', 'govet', 'godoc', 'rust', 'rustc', 'cargo', 'rustup', 'rustfmt',
  
  // Development Tools - Utilities (40+)
  'git', 'svn', 'hg', 'bzr', 'cvs', 'fossil', 'tig', 'gitk', 'git-flow', 'hub',
  'gh', 'glab', 'docker', 'docker-compose', 'podman', 'kubectl', 'helm', 'minikube', 'kind', 'k3s',
  'vagrant', 'terraform', 'ansible', 'puppet', 'chef', 'salt', 'packer', 'consul', 'vault', 'nomad',
  'vim', 'vi', 'nvim', 'emacs', 'nano', 'pico', 'ed', 'code', 'subl', 'atom',
  
  // Database & Data Tools (30+)
  'mysql', 'mysqldump', 'mysqladmin', 'psql', 'pg_dump', 'pg_restore', 'sqlite3', 'redis-cli', 'mongo', 'mongodump',
  'mongorestore', 'cqlsh', 'influx', 'clickhouse-client', 'mariadb', 'cockroach', 'etcdctl', 'consul', 'vault', 'nomad',
  'jq', 'yq', 'xmlstarlet', 'csvkit', 'miller', 'awk', 'sed', 'perl', 'lua', 'tcl',
  
  // System Administration (50+)
  'sudo', 'su', 'passwd', 'useradd', 'userdel', 'usermod', 'groupadd', 'groupdel', 'groupmod', 'id',
  'who', 'w', 'last', 'lastlog', 'finger', 'chfn', 'chsh', 'login', 'logout', 'exit',
  'systemctl', 'service', 'journalctl', 'systemd-analyze', 'init', 'telinit', 'runlevel', 'shutdown', 'reboot', 'halt',
  'poweroff', 'uptime', 'uname', 'hostname', 'hostnamectl', 'timedatectl', 'localectl', 'loginctl', 'machinectl', 'bootctl',
  'cron', 'crontab', 'at', 'batch', 'anacron', 'systemd-run', 'systemd-timer', 'logrotate', 'logger', 'dmesg',
  
  // Package Management (30+)
  'apt', 'apt-get', 'apt-cache', 'dpkg', 'dpkg-reconfigure', 'aptitude', 'snap', 'flatpak', 'appimage', 'alien',
  'yum', 'dnf', 'rpm', 'zypper', 'pacman', 'yaourt', 'yay', 'makepkg', 'abs', 'aur',
  'brew', 'port', 'pkg', 'emerge', 'portage', 'nix', 'guix', 'conda', 'mamba', 'micromamba',
  
  // Monitoring & Performance (30+)
  'top', 'htop', 'atop', 'btop', 'gtop', 'gotop', 'bashtop', 'bpytop', 'glances', 'nmon',
  'sar', 'iostat', 'mpstat', 'vmstat', 'pidstat', 'free', 'uptime', 'tload', 'slabtop', 'powertop',
  'iotop', 'iftop', 'nethogs', 'bmon', 'nload', 'speedtest', 'speedtest-cli', 'fast', 'mtr', 'smokeping',
  
  // Security Tools (30+)
  'gpg', 'gpg2', 'openssl', 'ssh-keygen', 'ssh-keyscan', 'ssl-cert', 'certbot', 'acme.sh', 'mkcert', 'step',
  'pass', 'keepassxc-cli', 'bitwarden', '1password', 'hashcat', 'john', 'hydra', 'ncrack', 'medusa', 'aircrack-ng',
  'chkrootkit', 'rkhunter', 'clamav', 'clamscan', 'freshclam', 'aide', 'tripwire', 'samhain', 'ossec', 'wazuh',
  
  // Shell & Scripting (30+)
  'bash', 'sh', 'zsh', 'fish', 'ksh', 'tcsh', 'csh', 'dash', 'ash', 'elvish',
  'export', 'alias', 'unalias', 'history', 'fc', 'source', 'eval', 'exec', 'command', 'builtin',
  'set', 'unset', 'env', 'printenv', 'echo', 'printf', 'read', 'test', 'expr', 'let',
  
  // Archive & Compression (20+)
  'tar', 'gzip', 'gunzip', 'bzip2', 'bunzip2', 'xz', 'unxz', 'lzma', 'unlzma', 'compress',
  'uncompress', 'zip', 'unzip', '7z', '7za', 'rar', 'unrar', 'ar', 'cpio', 'pax',
  
  // Media Tools (20+)
  'ffmpeg', 'ffplay', 'ffprobe', 'sox', 'play', 'rec', 'mpg123', 'mpg321', 'ogg123', 'flac',
  'lame', 'oggenc', 'opusenc', 'convert', 'mogrify', 'identify', 'display', 'import', 'animate', 'montage',
  
  // Math & Calculation (15+)
  'bc', 'dc', 'calc', 'qalc', 'units', 'factor', 'primes', 'seq', 'shuf', 'random',
  'octave', 'maxima', 'sage', 'r', 'julia',
  
  // Documentation & Help (15+)
  'man', 'info', 'help', 'apropos', 'whatis', 'whereis', 'which', 'type', 'command', 'hash',
  'tldr', 'cheat', 'howdoi', 'stackoverflow', 'explainshell',
  
  // Miscellaneous Utilities (30+)
  'date', 'cal', 'ncal', 'timedatectl', 'zdump', 'tzselect', 'hwclock', 'ntpdate', 'chrony', 'timeshift',
  'yes', 'true', 'false', 'sleep', 'usleep', 'seq', 'jot', 'shuf', 'tee', 'xargs',
  'parallel', 'rush', 'dsh', 'pssh', 'clusterssh', 'terminator', 'tilix', 'alacritty', 'kitty', 'wezterm',
] as const

/**
 * Get common commands that exist on the current system
 * @param systemCommands Array of commands available on the system
 * @returns Deduplicated intersection of common commands and system commands
 */
export function getCommonSystemCommands(systemCommands: string[]): string[] {
  const systemSet = new Set(systemCommands.map(cmd => cmd.toLowerCase()))
  const commonIntersection = COMMON_UNIX_COMMANDS.filter(cmd => systemSet.has(cmd.toLowerCase()))
  // Remove duplicates using Set
  return Array.from(new Set(commonIntersection))
}

/**
 * Get a priority score for a command based on its position in the common list
 * Earlier commands get higher priority (more commonly used)
 */
export function getCommandPriority(command: string): number {
  const index = COMMON_UNIX_COMMANDS.indexOf(command.toLowerCase() as any)
  if (index === -1) return 0
  
  // Convert index to priority score (earlier = higher score)
  const maxScore = 100
  const score = maxScore - (index / COMMON_UNIX_COMMANDS.length) * maxScore
  return Math.round(score)
}

/**
 * Get essential fallback commands for when PATH is empty or unavailable
 * These are the most basic commands that should always be available
 */
export function getEssentialCommands(): string[] {
  return [
    'ls', 'cd', 'pwd', 'cat', 'grep', 'find', 'which', 'man', 'cp', 'mv', 'rm', 'mkdir',
    'touch', 'chmod', 'ps', 'top', 'kill', 'git', 'node', 'npm', 'python3',
    'curl', 'wget', 'docker', 'vim', 'nano', 'echo', 'export', 'env', 'sudo'
  ]
}

/**
 * Get minimal fallback commands for error scenarios
 * These are absolute minimum commands for basic functionality
 */
export function getMinimalFallbackCommands(): string[] {
  return [
    'ls', 'cd', 'pwd', 'cat', 'grep', 'find', 'git', 'node', 'npm', 'python3', 'vim', 'nano'
  ]
}