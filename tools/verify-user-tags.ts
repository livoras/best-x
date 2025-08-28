import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 有效的标签列表
const VALID_TAGS = ['bc', 'tech', 'ent', 'celeb', 'org', 'unkn'];

interface VerificationResult {
  totalUsers: number;
  totalTaggedUsers: number;
  duplicateUsers: string[];
  missingUsers: string[];
  invalidTags: { userId: string; tags: string[] }[];
  emptyTags: string[];
  unknWithOtherTags: string[];
  fileIssues: string[];
}

async function verifyTags(): Promise<VerificationResult> {
  const tmpDir = '/tmp';
  const result: VerificationResult = {
    totalUsers: 0,
    totalTaggedUsers: 0,
    duplicateUsers: [],
    missingUsers: [],
    invalidTags: [],
    emptyTags: [],
    unknWithOtherTags: [],
    fileIssues: []
  };

  // 1. 读取所有原始 YAML 文件获取用户列表
  const yamlFiles = fs.readdirSync(tmpDir)
    .filter(f => f.endsWith('-simple.yml'))
    .sort();
  
  const allUserIds = new Set<string>();
  const userIdToFile = new Map<string, string>();
  
  for (const file of yamlFiles) {
    const filePath = path.join(tmpDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const users = yaml.load(content) as any[][];
    
    for (const user of users) {
      const userId = user[0];
      if (allUserIds.has(userId)) {
        result.duplicateUsers.push(userId);
      }
      allUserIds.add(userId);
      userIdToFile.set(userId, file);
      result.totalUsers++;
    }
  }
  
  // 2. 读取所有标签文件
  const tagFiles = fs.readdirSync(tmpDir)
    .filter(f => f.endsWith('-tags.json'))
    .sort();
  
  const taggedUserIds = new Set<string>();
  const userTagsMap = new Map<string, string[]>();
  
  for (const file of tagFiles) {
    const filePath = path.join(tmpDir, file);
    
    // 检查文件是否存在且可读
    if (!fs.existsSync(filePath)) {
      result.fileIssues.push(`文件不存在: ${file}`);
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    let tags: Record<string, string[]>;
    
    try {
      tags = JSON.parse(content);
    } catch (e) {
      result.fileIssues.push(`JSON 解析失败: ${file}`);
      continue;
    }
    
    for (const [userId, userTags] of Object.entries(tags)) {
      // 检查重复标签
      if (taggedUserIds.has(userId)) {
        result.duplicateUsers.push(userId);
      }
      taggedUserIds.add(userId);
      userTagsMap.set(userId, userTags);
      result.totalTaggedUsers++;
      
      // 检查空标签
      if (!userTags || userTags.length === 0) {
        result.emptyTags.push(userId);
      }
      
      // 检查无效标签
      const invalidUserTags = userTags.filter(tag => !VALID_TAGS.includes(tag));
      if (invalidUserTags.length > 0) {
        result.invalidTags.push({ userId, tags: invalidUserTags });
      }
      
      // 检查 unkn 与其他标签共存
      if (userTags.includes('unkn') && userTags.length > 1) {
        result.unknWithOtherTags.push(userId);
      }
    }
  }
  
  // 3. 查找遗漏的用户
  for (const userId of allUserIds) {
    if (!taggedUserIds.has(userId)) {
      result.missingUsers.push(userId);
    }
  }
  
  return result;
}

// 执行验证
verifyTags().then(result => {
  console.log('=== 标签验证报告 ===\n');
  
  console.log(`总用户数: ${result.totalUsers}`);
  console.log(`已标记用户数: ${result.totalTaggedUsers}`);
  
  if (result.fileIssues.length > 0) {
    console.log('\n❌ 文件问题:');
    result.fileIssues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  if (result.missingUsers.length > 0) {
    console.log(`\n❌ 遗漏用户 (${result.missingUsers.length} 个):`);
    result.missingUsers.slice(0, 10).forEach(id => console.log(`  - ${id}`));
    if (result.missingUsers.length > 10) {
      console.log(`  ... 还有 ${result.missingUsers.length - 10} 个`);
    }
  } else {
    console.log('\n✓ 没有遗漏用户');
  }
  
  if (result.duplicateUsers.length > 0) {
    console.log(`\n❌ 重复用户 (${result.duplicateUsers.length} 个):`);
    result.duplicateUsers.forEach(id => console.log(`  - ${id}`));
  } else {
    console.log('✓ 没有重复用户');
  }
  
  if (result.emptyTags.length > 0) {
    console.log(`\n❌ 空标签用户 (${result.emptyTags.length} 个):`);
    result.emptyTags.forEach(id => console.log(`  - ${id}`));
  } else {
    console.log('✓ 没有空标签');
  }
  
  if (result.invalidTags.length > 0) {
    console.log(`\n❌ 无效标签 (${result.invalidTags.length} 个用户):`);
    result.invalidTags.forEach(({ userId, tags }) => {
      console.log(`  - ${userId}: ${tags.join(', ')}`);
    });
  } else {
    console.log('✓ 所有标签都有效');
  }
  
  if (result.unknWithOtherTags.length > 0) {
    console.log(`\n❌ unkn 与其他标签共存 (${result.unknWithOtherTags.length} 个):`);
    result.unknWithOtherTags.forEach(id => console.log(`  - ${id}`));
  } else {
    console.log('✓ unkn 标签没有与其他标签共存');
  }
  
  // 最终结论
  const hasIssues = result.missingUsers.length > 0 || 
                   result.duplicateUsers.length > 0 || 
                   result.emptyTags.length > 0 || 
                   result.invalidTags.length > 0 || 
                   result.unknWithOtherTags.length > 0 ||
                   result.fileIssues.length > 0;
  
  if (hasIssues) {
    console.log('\n❌ 验证失败：存在问题需要修复');
  } else {
    console.log('\n✓ 验证通过：所有用户都已正确标记');
  }
}).catch(console.error);