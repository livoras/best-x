# Twitter Users YAML Format

## 文件结构

每个 YAML 文件包含一个二维数组，每个子数组代表一个 Twitter 用户，包含 6 个固定顺序的字段：

```yaml
- - "userId"          # [0] 用户ID (字符串)
  - username          # [1] 用户名
  - "@handle"         # [2] @句柄
  - "bio text"        # [3] 个人简介 (可能为空字符串)
  - true/false        # [4] 是否认证
  - true/false        # [5] 是否组织账号
```

## 示例

```yaml
- - "2152132381"
  - kregenrek
  - "@kregenrek"
  - |-
    Teaching & building AI apps → http://instructa.ai
    → Cursor Course 
    → Newsletter: http://instructa.ai/newsletter
  - true
  - false

- - "884941790821851136"
  - JeremyDanielFox
  - "@JeremyDanielFox"
  - Building Claude @AnthropicAI. Ex @google. My views are my own.
  - false
  - false

- - "1618521"
  - CatChen
  - "@CatChen"
  - ""                # 空的 bio
  - true
  - false
```

## 字段说明

| 索引 | 含义 | 类型 | 说明 |
|------|------|------|------|
| 0 | userId | string | Twitter 用户唯一ID |
| 1 | username | string | 用户名（不含@） |
| 2 | handle | string | 完整句柄（含@） |
| 3 | bio | string | 个人简介，可为空字符串 |
| 4 | isVerified | boolean | 是否认证用户 |
| 5 | isOrganization | boolean | 是否组织/机构账号 |

## 文件命名

```
users-[timestamp]-part[N]-[start]to[end]-simple.yml
```

示例：`users-1756350414822-part1-1to100-simple.yml`

## 使用场景

这种简化格式适合：
- AI 模型批量处理用户数据
- 快速扫描用户列表
- 减少数据冗余，提高处理效率

转换工具：`tools/convert-users-to-yaml.ts`

## 用户分类标签体系

### 标签定义（共6个）

#### 内容领域类（可多选）
1. **区块链** - 加密货币、DeFi、NFT、Web3 相关（独立领域，不属于科技）
2. **科技** - AI、软件开发、硬件、互联网技术（不包含区块链）
3. **娱乐圈** - 明星、音乐、影视、体育、艺术

#### 身份属性类（可多选）
4. **名人** - 有社会影响力的个人账号（通常 isVerified = true）
5. **机构或组织** - 公司、团队、项目方、媒体（通常 isOrganization = true）

#### 兜底标签
6. **未知** - 无法归类到以上任何标签（与其他所有标签互斥）

### 标签组合规则

1. **内容领域 + 身份属性可组合**
   - 例：Vitalik Buterin → `[区块链, 名人]`
   - 例：OpenAI → `[科技, 机构]`
   - 例：Taylor Swift → `[娱乐圈, 名人]`

2. **未知标签的互斥性**
   - 只要有任何其他标签，就不标记"未知"
   - 只有完全无法判断类别的用户才标记"未知"

3. **判定优先级**
   - 先判定身份属性（名人/机构）
   - 再判定内容领域（区块链/科技/娱乐圈）
   - 最后考虑是否标记为未知

### 判定参考关键词

**区块链关键词**
- crypto, blockchain, DeFi, NFT, Web3, Bitcoin, Ethereum, Solana
- 代币, 挖矿, 链游, 加密, 数字货币

**科技关键词**
- AI, ML, engineer, developer, founder, CEO, startup, building
- 研究员, 程序员, 技术, 开发者, 工程师

**娱乐圈关键词**
- singer, actor, artist, music, film, sports
- 歌手, 演员, 艺人, 导演, 音乐, 电影, 体育

**机构标识**
- Inc, Corp, Foundation, Labs, Studio
- 研究院, 实验室, 公司, 基金会

### 标签输出格式

#### JSON 格式
```json
{
  "userId": ["tag1", "tag2"],
  "userId": ["tag"],
  "userId": ["unkn"]
}
```

#### 标签缩写定义
- `"bc"` - 区块链 (blockchain)
- `"tech"` - 科技 (technology)
- `"ent"` - 娱乐圈 (entertainment)
- `"celeb"` - 名人 (celebrity)
- `"org"` - 机构或组织 (organization)
- `"unkn"` - 未知 (unknown)

#### 输出示例
```json
{
  "2152132381": ["tech", "celeb"],
  "1913258409677512704": ["tech"],
  "884941790821851136": ["tech"],
  "1864118058975154176": ["tech", "org"],
  "44196397": ["tech", "celeb"],
  "73992972": ["ent", "celeb"],
  "20536157": ["tech", "org"],
  "10228272": ["ent", "org"],
  "1618521": ["unkn"]
}
```

#### 常见标签组合
- `["bc", "celeb"]` - 区块链名人（如 Vitalik Buterin）
- `["bc", "org"]` - 区块链机构（如 Binance）
- `["tech", "celeb"]` - 科技名人（如 Elon Musk）
- `["tech", "org"]` - 科技机构（如 OpenAI）
- `["ent", "celeb"]` - 娱乐明星（如 Taylor Swift）
- `["ent", "org"]` - 娱乐机构（如 Netflix）
- `["unkn"]` - 无法分类的用户

## AI 标签生成要求

### 处理流程
1. **逐个读取 YAML 文件**
   - 依次读取每个 `users-*-simple.yml` 文件
   - 每个文件包含 100 个用户（最后一个文件 7 个）
   - 共 16 个文件，确保无遗漏

2. **分析每个用户**
   - 读取 6 个字段：userId, username, handle, bio, isVerified, isOrganization
   - 基于 bio 内容进行关键词匹配
   - 结合 isVerified 和 isOrganization 状态判定

3. **生成标签文件**
   - 为每个 YAML 文件生成对应的 JSON 标签文件
   - 输入：`users-*-simple.yml`
   - 输出：`users-*-tags.json`

### 判定规则优先级
1. **身份属性判定**（基于布尔字段）
   - `isOrganization = true` → 添加 `"org"` 标签
   - `isVerified = true && isOrganization = false` → 考虑添加 `"celeb"` 标签

2. **内容领域判定**（基于 bio 文本分析）
   - 检查区块链关键词 → 添加 `"bc"` 标签
   - 检查科技关键词 → 添加 `"tech"` 标签
   - 检查娱乐关键词 → 添加 `"ent"` 标签

3. **未知判定**
   - 如果没有匹配到任何标签 → 添加 `"unkn"` 标签
   - `"unkn"` 与其他所有标签互斥

### 注意事项
- 每个用户可以有 0-2 个标签（不含 unkn）或仅 1 个 unkn 标签
- 区块链领域独立于科技，两者不重叠
- 空 bio 不代表 unknown，还要看其他字段
- 保持 userId 与原文件完全一致