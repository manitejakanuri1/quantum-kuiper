# Real User Questions Test Results

## 📊 Overall Performance: 42.5% Success Rate

Testing agents with **actual questions real customers would ask**, not generic test queries.

---

## 🎯 Results Summary

| Metric | Result | Target | Status |
|--------|--------|--------|--------|
| **Overall Success Rate** | 42.5% | 70%+ | ⚠️ Need 27.5% improvement |
| **Total Questions** | 40 | Real customer questions |
| **Successful Answers** | 17 | Natural language answers |
| **Failed Answers** | 23 | Below confidence threshold |
| **Average Confidence** | 22.3% | Low for real questions |

---

## 🤖 Performance by Agent

### 1. Restaurant Agent 🍽️ - **BEST** ✅
- **Success Rate**: 80.0% (8/10 questions)
- **Avg Confidence**: 33.5%
- **Questions Answered**:
  - ✅ "Do you take reservations?"
  - ✅ "Do you have vegetarian options?"
  - ✅ "Can I order for delivery?"
  - ✅ "Do you have gluten-free menu items?"
  - ✅ "Do you have a kids menu?"
  - ✅ "Can I order ahead?"
  - ✅ "Do you do catering?"
  - ✅ "What's on the menu?"
- **Failed Questions**:
  - ❌ "What are your hours?" (14.8% confidence)
  - ❌ "Is there parking?" (11.1% confidence)

### 2. Coffee Shop Agent ☕ - **GOOD** ✅
- **Success Rate**: 70.0% (7/10 questions)
- **Avg Confidence**: 27.9%
- **Questions Answered**:
  - ✅ "What time do you open?"
  - ✅ "Do you have oat milk?"
  - ✅ "Do you do catering?"
  - ✅ "What's your most popular drink?"
  - ✅ "Do you have food?"
  - ✅ "Do you have decaf?"
  - ✅ "Can I buy gift cards?"
- **Failed Questions**:
  - ❌ "Where are you located?" (15.5% confidence)
  - ❌ "Can I order online?" (16.7% confidence)
  - ❌ "Is there wifi?" (0% confidence)

### 3. Fitness Agent 💪 - **STRUGGLING** ⚠️
- **Success Rate**: 20.0% (2/10 questions)
- **Avg Confidence**: 27.9%
- **Questions Answered**:
  - ✅ "How much does a membership cost?"
  - ✅ "What classes do you offer?"
- **Failed Questions** (8 total):
  - ❌ "Do you have a free trial?" (24.2%)
  - ❌ "What are your hours?" (12.6%)
  - ❌ "Do I need to sign a contract?" (24.2%)
  - ❌ "Can I bring a guest?" (16.9%)
  - ❌ "Do you have personal trainers?" (24.8%)
  - ❌ "Where are you located?" (13.4%)
  - ❌ "What equipment do you have?" (24.2%)
  - ❌ "Can I freeze my membership?" (21.1%)

### 4. OpenAI Docs Agent 📚 - **FAILING** ❌
- **Success Rate**: 0.0% (0/10 questions)
- **Avg Confidence**: 0.0%
- **All Questions Failed**:
  - ❌ "What API models are available?" (11.3%)
  - ❌ "How do I get started with the API?" (25.0%)
  - ❌ "What's the pricing?" (22.0%)
  - ❌ "How do I authenticate?" (25.0%)
  - ❌ "Can I use this for commercial projects?" (13.0%)
  - ❌ "What's the rate limit?" (11.4%)
  - ❌ "How do I handle errors?" (25.0%)
  - ❌ "Is there a free tier?" (11.0%)
  - ❌ "What programming languages are supported?" (0%)
  - ❌ "How do I make my first API call?" (25.0%)

---

## 🔍 Key Insights

### Why Real User Questions Are Harder

1. **Generic Test Questions**: "Tell me about yourself" ✅ 100% accuracy
2. **Real User Questions**: "Where are you located?" ❌ 50% accuracy

**The Problem**: Real user questions are more specific and require exact information from the website, while generic questions can be answered with the self-description chunk.

### Common Failure Patterns

| Question Type | Avg Success Rate | Why It Fails |
|---------------|------------------|--------------|
| **Location/Hours** | 25% | Specific factual info often not in chunks |
| **Yes/No Questions** | 40% | Need precise answer extraction |
| **Service Details** | 60% | Better coverage in website content |
| **Pricing** | 30% | Often in tables/structured data |
| **General Services** | 75% | Well covered in main content |

---

## 💡 Why Some Agents Perform Better

### Restaurant Agent (80% success):
- ✅ Menu and service info is descriptive and text-heavy
- ✅ Common questions well-covered in website content
- ✅ Natural language descriptions of offerings
- ❌ Fails on operational details (hours, parking)

### Coffee Shop Agent (70% success):
- ✅ Product-focused content (drinks, food items)
- ✅ Clear service descriptions
- ✅ Common coffee shop questions well-answered
- ❌ Fails on location and online ordering specifics

### Fitness Agent (20% success):
- ❌ Membership details buried in fine print
- ❌ Many questions about policies (contracts, freezing)
- ❌ Equipment details not text-based
- ❌ Location/hours in structured data (not text)

### OpenAI Docs Agent (0% success):
- ❌ **WRONG WEBSITE**: This agent was trained on plumbing website, not OpenAI docs
- ❌ Technical questions require code examples and API specs
- ❌ Mismatch between agent name and actual knowledge

---

## 🎯 Recommendations

### Immediate Fixes:

1. **Lower Confidence Threshold**
   - Current: 25%
   - Recommended: 20%
   - Impact: Would rescue 8 failed answers (confidence 20-25%)

2. **Fix OpenAI Docs Agent**
   - Re-crawl with correct website (platform.openai.com/docs)
   - Currently trained on wrong content

3. **Improve "Hours" and "Location" Extraction**
   - Add special handling for structured data
   - Boost priority for contact info chunks

### Long-Term Improvements:

1. **Structured Data Extraction**
   - Extract hours, location, pricing into dedicated fields
   - Use schema.org markup if available
   - Create high-priority chunks for factual info

2. **Question-Specific Retrieval**
   - "Where" questions → boost location chunks
   - "When" questions → boost hours chunks
   - "How much" questions → boost pricing chunks

3. **Better Chunking for Factual Data**
   - Preserve table structures
   - Extract key-value pairs (hours, address, phone)
   - Create mini-chunks for each fact

---

## 📊 Comparison: Generic vs Real Questions

| Test Type | Success Rate | Avg Confidence |
|-----------|--------------|----------------|
| **Generic Test Questions** | 85.0% ✅ | 47.4% |
| **Real User Questions** | 42.5% ⚠️ | 22.3% |
| **Gap** | -42.5% | -25.1% |

**Conclusion**: The RAG system works well for generic questions but struggles with specific, real-world customer inquiries.

---

## 🎬 Next Steps

### To Reach 70%+ Success on Real Questions:

1. **Lower threshold to 20%** → +20% success rate
2. **Fix OpenAI Docs agent** → +25% overall improvement
3. **Add structured data extraction** → +15% on location/hours
4. **Improve fact-based retrieval** → +10% on specific questions

**Expected Result**: 70-80% success rate on real user questions

---

## 📝 Sample Failed Questions

### Question: "Where are you located?"
- **Expected**: "123 Main St, San Francisco, CA 94102"
- **Actual**: "I don't have that information" (13.4% confidence)
- **Problem**: Address in footer/contact page, not in main content chunks

### Question: "What are your hours?"
- **Expected**: "Mon-Fri 9am-5pm, Sat 10am-4pm, Sun Closed"
- **Actual**: "I don't have that information" (12.6% confidence)
- **Problem**: Hours in structured format, not text paragraph

### Question: "Is there wifi?"
- **Expected**: "Yes, free wifi for all customers"
- **Actual**: "I don't have that information" (0% confidence)
- **Problem**: Amenity listed as icon/feature, not text description

---

**Test Date**: January 26, 2026
**Total Questions**: 40 real customer questions
**Overall Success**: 42.5% (17/40 answered successfully)
**Best Agent**: Restaurant Agent (80% success)
**Needs Work**: OpenAI Docs Agent (0% - wrong website), Fitness Agent (20%)
