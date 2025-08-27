import { PlaywrightClient } from 'better-playwright-mcp';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

export interface ScrapeOptions {
  scrollTimes?: number;
  maxItems?: number;
}

/**
 * 通用爬虫基类
 * @template TItem - 单个数据项的类型
 * @template TResult - 最终返回结果的类型
 */
export abstract class ScraperBase<TItem, TResult> {
  protected client: PlaywrightClient;
  protected seenIds = new Set<string>();
  protected items: TItem[] = [];
  protected pageId?: string;
  protected url?: string;
  
  constructor(protected serverUrl = 'http://localhost:3103') {
    this.client = new PlaywrightClient(serverUrl);
  }
  
  /**
   * 从HTML中提取数据项
   * @param html - 页面HTML内容
   * @returns 提取的数据项数组
   */
  abstract extractItems(html: string): TItem[];
  
  /**
   * 获取数据项的唯一标识符
   * @param item - 数据项
   * @returns 唯一标识符
   */
  abstract getItemId(item: TItem): string;
  
  /**
   * 构建最终返回结果
   * @returns 处理后的结果
   */
  abstract buildResult(): TResult;
  
  /**
   * 主爬取流程
   * @param url - 目标URL
   * @param options - 爬取选项
   * @returns 爬取结果
   */
  async scrape(url: string, options?: ScrapeOptions): Promise<TResult> {
    try {
      this.url = url;
      
      // 1. 打开页面
      console.log(`📖 打开页面: ${url}`);
      const { pageId } = await this.client.createPage(
        'scraper',
        'Web Scraper',
        url,
        3000
      );
      this.pageId = pageId;
      await this.client.waitForTimeout(pageId, 3000);
      
      // 2. 初始提取
      console.log('📸 提取初始内容...');
      const html = await this.getPageHtml();
      const initialItems = this.extractItems(html);
      const initialCount = this.collectNewItems(initialItems);
      console.log(`📊 初始加载: ${initialCount} 个项目`);
      
      // 3. 滚动加载（如果需要）
      if (options?.scrollTimes && options.scrollTimes > 0) {
        await this.scrollAndCollect(options.scrollTimes, options.maxItems);
      }
      
      // 4. 输出统计
      console.log(`\n📊 收集统计:`);
      console.log(`  - 总共收集: ${this.items.length} 个项目`);
      console.log(`  - 去重后: ${this.seenIds.size} 个唯一项目`);
      
      // 5. 构建返回结果
      return this.buildResult();
      
    } catch (error) {
      console.error('❌ 爬取失败:', error);
      throw error;
    } finally {
      // 清理资源
      if (this.pageId) {
        console.log('🧹 关闭页面...');
        await this.client.closePage(this.pageId);
        this.pageId = undefined;
      }
    }
  }
  
  /**
   * 滚动并收集数据
   * @param scrollTimes - 最大滚动次数
   * @param maxItems - 最大项目数限制
   */
  protected async scrollAndCollect(scrollTimes: number, maxItems?: number): Promise<void> {
    console.log(`🔄 开始滚动（最多 ${scrollTimes} 次）...`);
    let noNewContentCount = 0;
    
    for (let i = 0; i < scrollTimes; i++) {
      // 检查是否已达到最大数量
      if (maxItems && this.items.length >= maxItems) {
        console.log(`  🛑 已达到最大数量限制 (${maxItems})，停止滚动`);
        break;
      }
      
      const countBefore = this.seenIds.size;
      
      // 执行标准滚动单位（3次PageDown）
      await this.performScroll();
      
      // 提取新内容
      console.log(`  📜 第 ${i + 1} 次滚动...`);
      const html = await this.getPageHtml();
      const newItems = this.extractItems(html);
      const added = this.collectNewItems(newItems);
      
      const countAfter = this.seenIds.size;
      const uniqueAdded = countAfter - countBefore;
      
      console.log(`    📊 本次新增: ${added} 个项目（${uniqueAdded} 个唯一）`);
      
      // 检查终止条件
      if (uniqueAdded === 0) {
        noNewContentCount++;
        console.log(`    ⚠️  本次无新内容（连续 ${noNewContentCount} 次）`);
        
        if (noNewContentCount >= 2) {
          console.log(`  🛑 连续2次无新内容，已到达底部，停止滚动`);
          break;
        }
      } else {
        noNewContentCount = 0;
      }
    }
  }
  
  /**
   * 收集新项目（带去重）
   * @param newItems - 新提取的项目
   * @returns 实际添加的项目数
   */
  protected collectNewItems(newItems: TItem[]): number {
    let added = 0;
    
    for (const item of newItems) {
      const id = this.getItemId(item);
      
      if (!id) {
        console.log(`    ⚠️  跳过无ID项目`);
        continue;
      }
      
      if (!this.seenIds.has(id)) {
        this.seenIds.add(id);
        this.items.push(item);
        added++;
        
        // 可选：子类可以覆盖此方法来定制日志
        this.onItemCollected(item, id);
      } else {
        // 可选：子类可以覆盖此方法来定制日志
        this.onDuplicateItem(item, id);
      }
    }
    
    return added;
  }
  
  /**
   * 当收集到新项目时的钩子（子类可覆盖）
   */
  protected onItemCollected(item: TItem, id: string): void {
    // 默认不输出详细日志，子类可以覆盖
  }
  
  /**
   * 当遇到重复项目时的钩子（子类可覆盖）
   */
  protected onDuplicateItem(item: TItem, id: string): void {
    // 默认不输出详细日志，子类可以覆盖
  }
  
  /**
   * 获取当前页面的HTML内容
   * @returns HTML字符串
   */
  protected async getPageHtml(): Promise<string> {
    if (!this.pageId) {
      throw new Error('页面未打开');
    }
    
    const htmlFile = await this.client.pageToHtmlFile(this.pageId, false);
    return fs.readFileSync(htmlFile.filePath, 'utf-8');
  }
  
  /**
   * 执行标准滚动操作
   */
  protected async performScroll(): Promise<void> {
    if (!this.pageId) {
      throw new Error('页面未打开');
    }
    
    // 标准滚动单位：3次PageDown
    for (let i = 0; i < 3; i++) {
      await this.client.browserPressKey(this.pageId, 'PageDown', undefined, 300);
    }
    
    // 等待内容加载
    await this.client.waitForTimeout(this.pageId, 1000);
  }
  
  /**
   * 获取已收集的所有项目
   */
  protected getItems(): TItem[] {
    return this.items;
  }
  
  /**
   * 获取已收集的项目数量
   */
  protected getCount(): number {
    return this.items.length;
  }
  
  /**
   * 检查是否已收集某个ID的项目
   */
  protected hasItem(id: string): boolean {
    return this.seenIds.has(id);
  }
  
  /**
   * 清空已收集的数据（用于重新开始）
   */
  protected reset(): void {
    this.seenIds.clear();
    this.items = [];
  }
}

// 导出cheerio供子类使用
export { cheerio };