import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { FollowingsResult, FollowingUser } from '../types/following';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function splitUsersToFiles(jsonFile: string, chunkSize: number = 100) {
  // 读取原始 JSON 文件
  const jsonData = fs.readFileSync(jsonFile, 'utf-8');
  const result: FollowingsResult = JSON.parse(jsonData);
  
  const users = result.users;
  const totalUsers = users.length;
  const totalFiles = Math.ceil(totalUsers / chunkSize);
  
  console.log(`总用户数: ${totalUsers}`);
  console.log(`将分割为 ${totalFiles} 个文件（每个 ${chunkSize} 用户）`);
  
  // 生成时间戳作为文件名前缀
  const timestamp = Date.now();
  
  // 分批写入文件
  for (let i = 0; i < totalFiles; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalUsers);
    const chunk = users.slice(start, end);
    
    // 构建文件名：users-<时间戳>-part<序号>-<起始>to<结束>.json
    const filename = `/tmp/users-${timestamp}-part${i + 1}-${start + 1}to${end}.json`;
    
    // 写入文件
    const fileData = {
      part: i + 1,
      total_parts: totalFiles,
      users_in_file: chunk.length,
      range: `${start + 1}-${end}`,
      timestamp: new Date().toISOString(),
      users: chunk
    };
    
    fs.writeFileSync(filename, JSON.stringify(fileData, null, 2));
    console.log(`✓ 写入文件 ${i + 1}/${totalFiles}: ${filename} (${chunk.length} 用户)`);
  }
  
  console.log(`\n完成！已将 ${totalUsers} 个用户分割到 ${totalFiles} 个文件`);
  return totalFiles;
}

// 命令行支持
if (process.argv[2]) {
  const jsonFile = process.argv[2];
  const chunkSize = process.argv[3] ? parseInt(process.argv[3]) : 100;
  
  if (!fs.existsSync(jsonFile)) {
    console.error(`文件不存在: ${jsonFile}`);
    process.exit(1);
  }
  
  splitUsersToFiles(jsonFile, chunkSize);
} else {
  console.log(`用法: tsx split-users-to-files.ts <json文件> [每文件用户数]
示例: tsx split-users-to-files.ts /tmp/followings-livoras-1756311782861.json 100`);
}

export { splitUsersToFiles };