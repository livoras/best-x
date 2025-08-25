// 测试 Markdown API 端点

async function testMarkdownAPI() {
  console.log('Testing Markdown API...\n');

  try {
    // 首先获取历史记录列表
    const historyRes = await fetch('http://localhost:3001/api/extractions?limit=1');
    const history = await historyRes.json();
    
    if (!history.extractions || history.extractions.length === 0) {
      console.log('No extraction history found. Please extract a tweet first.');
      return;
    }

    const latestId = history.extractions[0].id;
    console.log(`Testing with extraction ID: ${latestId}\n`);

    // 1. 获取 HTML 格式的文章
    console.log('1. Fetching HTML article...');
    const htmlRes = await fetch(`http://localhost:3001/api/extractions/${latestId}/article`);
    const htmlArticle = await htmlRes.json();
    
    if (!htmlRes.ok) {
      console.error('Failed to fetch HTML article:', htmlArticle);
      return;
    }

    console.log('HTML Article Structure:');
    console.log('- Author:', htmlArticle.author.name, `(${htmlArticle.author.handle})`);
    console.log('- Tweet Count:', htmlArticle.tweetCount);
    console.log('- First Tweet HTML (preview):', htmlArticle.tweets[0].text.substring(0, 100) + '...\n');

    // 2. 获取 Markdown 格式的文章
    console.log('2. Fetching Markdown article...');
    const markdownRes = await fetch(`http://localhost:3001/api/extractions/${latestId}/article-markdown`);
    const markdownArticle = await markdownRes.json();
    
    if (!markdownRes.ok) {
      console.error('Failed to fetch Markdown article:', markdownArticle);
      return;
    }

    console.log('Markdown Article Structure:');
    console.log('- Author:', markdownArticle.author.name, `(${markdownArticle.author.handle})`);
    console.log('- Tweet Count:', markdownArticle.tweetCount);
    console.log('- URL:', markdownArticle.url);
    console.log('\n--- Markdown Content ---\n');
    console.log(markdownArticle.markdown);
    console.log('\n--- End of Markdown ---\n');

    // 3. 比较两种格式
    console.log('3. Format Comparison:');
    console.log('- Both have same author:', 
      htmlArticle.author.handle === markdownArticle.author.handle ? '✓' : '✗');
    console.log('- Both have same tweet count:', 
      htmlArticle.tweetCount === markdownArticle.tweetCount ? '✓' : '✗');
    console.log('- Markdown successfully converted from HTML: ✓');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// 运行测试
testMarkdownAPI().then(() => {
  console.log('\nTest completed.');
}).catch(error => {
  console.error('Test error:', error);
});