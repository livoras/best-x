import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function convertToYaml() {
  const tmpDir = '/tmp';
  
  // 查找所有用户数据文件
  const files = fs.readdirSync(tmpDir)
    .filter(f => f.startsWith('users-') && f.endsWith('.json'))
    .sort();
  
  console.log(`找到 ${files.length} 个JSON文件`);
  
  let totalUsers = 0;
  
  for (const file of files) {
    const inputPath = path.join(tmpDir, file);
    const outputPath = inputPath.replace('.json', '-simple.yml');
    
    console.log(`\n处理文件: ${file}`);
    
    // 读取JSON文件
    const content = fs.readFileSync(inputPath, 'utf-8');
    const data = JSON.parse(content);
    
    // 只提取需要的字段，转换为数组格式
    const simplifiedUsers = data.users.map((user: any) => [
      user.userId,
      user.username,
      user.handle,
      user.bio || '',
      user.isVerified,
      user.isOrganization
    ]);
    
    // 转换为YAML - 只包含用户数组
    const yamlContent = yaml.dump(simplifiedUsers, {
      lineWidth: -1, // 不限制行宽
      noRefs: true,
      quotingType: '"',
      forceQuotes: false
    });
    
    // 写入YAML文件
    fs.writeFileSync(outputPath, yamlContent);
    
    totalUsers += simplifiedUsers.length;
    console.log(`  ✅ 已转换 ${simplifiedUsers.length} 个用户 -> ${path.basename(outputPath)}`);
    
    // 显示示例
    if (simplifiedUsers.length > 0) {
      console.log(`  示例用户: @${simplifiedUsers[0][1]}`);
      if (simplifiedUsers[0][3]) {
        console.log(`    Bio: "${simplifiedUsers[0][3].substring(0, 50)}..."`);
      }
    }
  }
  
  console.log(`\n✅ 转换完成！共处理 ${totalUsers} 个用户`);
  console.log(`YAML文件已保存到 /tmp 目录（文件名后缀为-simple.yml）`);
}

// 运行转换
convertToYaml().catch(console.error);