import { claude, query, ConsoleLogger, LogLevel } from 'claude-code-sdk-ts2';

async function testClaudeSDK() {
  console.log('Testing Claude Code SDK...\n');

  try {
    // 测试1: 基本查询功能
    console.log('1. 测试基本查询功能');
    const response = await claude()
      .withModel('sonnet')
      .skipPermissions()
      .query('请用一句话介绍你自己')
      .asText();
    
    console.log('   响应:', response);

    // 测试2: 使用 query 函数（处理 AsyncGenerator）
    console.log('\n2. 测试 query 函数');
    const simpleResponse = query('计算 2 + 2 等于多少？');
    let fullResponse = '';
    for await (const chunk of simpleResponse) {
      if (chunk.type === 'assistant' && chunk.content) {
        for (const block of chunk.content) {
          if (block.type === 'text') {
            fullResponse += block.text;
          }
        }
      }
    }
    console.log('   响应:', fullResponse);

    // 测试3: 带日志的查询
    console.log('\n3. 测试带日志的查询');
    const logger = new ConsoleLogger(LogLevel.INFO, '[Test]');
    const loggedResponse = await claude()
      .withLogger(logger)
      .skipPermissions()
      .query('说 "Hello World"')
      .asText();
    
    console.log('   响应:', loggedResponse);

    // 测试4: JSON 格式响应
    console.log('\n4. 测试 JSON 格式响应');
    const jsonResponse = await claude()
      .skipPermissions()
      .query('生成一个包含 name 和 age 字段的 JSON 对象示例')
      .asJSON();
    
    console.log('   JSON 响应:', JSON.stringify(jsonResponse, null, 2));

  } catch (error) {
    console.error('Error testing Claude SDK:', error);
  }
}

// 运行测试
testClaudeSDK().then(() => {
  console.log('\n测试完成');
}).catch(error => {
  console.error('测试失败:', error);
});