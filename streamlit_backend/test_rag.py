"""
RAG Quality Testing Suite
Run this before deploying to production to verify your RAG system is working correctly.

Usage:
    python test_rag.py --agent-id YOUR_AGENT_ID
    python test_rag.py --agent-id YOUR_AGENT_ID --verbose
"""

import requests
import argparse
import json
from datetime import datetime
from typing import List, Dict, Tuple, Optional

# Configuration
RAG_API_URL = "http://localhost:8000"
SIMILARITY_THRESHOLD = 0.3  # 30% minimum

# ============================================================================
# TEST CASES
# ============================================================================

# Format: (query, should_match, expected_keywords_in_response)
# should_match = True means we expect a good answer
# should_match = False means we expect a fallback (tests threshold)

DEFAULT_TEST_CASES = [
    # ===== SHOULD MATCH (Good Queries) =====
    ("What services do you offer?", True, ["service", "offer", "training"]),
    ("What are your hours?", True, ["hour", "open", "am", "pm"]),
    ("Where are you located?", True, ["location", "address", "area"]),
    ("How can I contact you?", True, ["phone", "email", "contact", "call"]),
    ("How do I register?", True, ["register", "enroll", "sign"]),
    ("What documents do I need?", True, ["document", "id", "passport"]),
    ("Do you offer training in multiple languages?", True, ["language", "arabic", "english"]),
    
    # ===== SHOULD NOT MATCH (Edge Cases - Must Return Fallback) =====
    ("What is the capital of France?", False, None),
    ("Tell me about quantum physics", False, None),
    ("Random gibberish xyz123 abc", False, None),
    ("How do I fly to the moon?", False, None),
]


# ============================================================================
# TEST RUNNER
# ============================================================================

class RAGTester:
    def __init__(self, agent_id: str, api_url: str = RAG_API_URL, verbose: bool = False):
        self.agent_id = agent_id
        self.api_url = api_url
        self.verbose = verbose
        self.results = []
        
    def query_rag(self, query: str) -> Dict:
        """Query the RAG API"""
        try:
            response = requests.post(
                f"{self.api_url}/api/query",
                json={"query": query, "agent_id": self.agent_id},
                timeout=10
            )
            if response.ok:
                return response.json()
            else:
                return {"error": response.text, "found": False, "threshold_met": False}
        except Exception as e:
            return {"error": str(e), "found": False, "threshold_met": False}
    
    def run_test(
        self, 
        query: str, 
        should_match: bool, 
        expected_keywords: Optional[List[str]] = None
    ) -> Dict:
        """Run a single test case"""
        result = self.query_rag(query)
        
        # Determine if test passed
        passed = False
        reason = ""
        
        if "error" in result:
            passed = False
            reason = f"API Error: {result['error']}"
        elif should_match:
            # We expected a match
            if result.get("found") and result.get("threshold_met"):
                # Check if expected keywords are in response
                if expected_keywords:
                    response_lower = result.get("text", "").lower()
                    keywords_found = [kw for kw in expected_keywords if kw.lower() in response_lower]
                    if keywords_found:
                        passed = True
                        reason = f"Matched with keywords: {keywords_found}"
                    else:
                        passed = False
                        reason = f"Matched but missing keywords: {expected_keywords}"
                else:
                    passed = True
                    reason = "Matched successfully"
            else:
                passed = False
                similarity = result.get("similarity", 0)
                reason = f"Expected match but got fallback (similarity: {similarity:.1%})"
        else:
            # We expected NO match (should use fallback)
            if not result.get("found") or not result.get("threshold_met"):
                passed = True
                reason = "Correctly returned fallback"
            else:
                passed = False
                reason = f"Should have returned fallback but matched: {result.get('question_matched')}"
        
        test_result = {
            "query": query,
            "should_match": should_match,
            "passed": passed,
            "reason": reason,
            "found": result.get("found", False),
            "threshold_met": result.get("threshold_met", False),
            "similarity": result.get("similarity", 0),
            "response_preview": result.get("text", "")[:100] + "..." if result.get("text") else ""
        }
        
        self.results.append(test_result)
        return test_result
    
    def run_all_tests(self, test_cases: List[Tuple] = None) -> Dict:
        """Run all test cases"""
        if test_cases is None:
            test_cases = DEFAULT_TEST_CASES
        
        print("\n" + "=" * 70)
        print("🧪 RAG QUALITY TEST SUITE")
        print("=" * 70)
        print(f"Agent ID: {self.agent_id}")
        print(f"API URL: {self.api_url}")
        print(f"Test Cases: {len(test_cases)}")
        print(f"Threshold: {SIMILARITY_THRESHOLD:.0%}")
        print("=" * 70 + "\n")
        
        for i, (query, should_match, keywords) in enumerate(test_cases, 1):
            result = self.run_test(query, should_match, keywords)
            
            status = "✅ PASS" if result["passed"] else "❌ FAIL"
            similarity = f"{result['similarity']:.1%}" if result['similarity'] else "N/A"
            
            print(f"[{i:02d}] {status} | Sim: {similarity:>5} | {query[:50]}")
            if self.verbose or not result["passed"]:
                print(f"     → {result['reason']}")
                if self.verbose:
                    print(f"     → Response: {result['response_preview']}")
            print()
        
        return self.generate_report()
    
    def generate_report(self) -> Dict:
        """Generate final test report"""
        total = len(self.results)
        passed = sum(1 for r in self.results if r["passed"])
        failed = total - passed
        
        # Calculate metrics
        match_tests = [r for r in self.results if r["should_match"]]
        no_match_tests = [r for r in self.results if not r["should_match"]]
        
        hit_rate = sum(1 for r in match_tests if r["passed"]) / len(match_tests) * 100 if match_tests else 0
        false_positive_rate = sum(1 for r in no_match_tests if not r["passed"]) / len(no_match_tests) * 100 if no_match_tests else 0
        
        avg_similarity = sum(r["similarity"] for r in match_tests if r["passed"]) / max(1, sum(1 for r in match_tests if r["passed"]))
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "agent_id": self.agent_id,
            "total_tests": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": f"{(passed/total)*100:.1f}%",
            "hit_rate": f"{hit_rate:.1f}%",
            "false_positive_rate": f"{false_positive_rate:.1f}%",
            "avg_similarity": f"{avg_similarity:.1%}",
            "ready_for_production": passed == total,
            "failed_tests": [r for r in self.results if not r["passed"]]
        }
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 70)
        print(f"Total Tests:        {total}")
        print(f"Passed:             {passed} ✅")
        print(f"Failed:             {failed} ❌")
        print(f"Pass Rate:          {report['pass_rate']}")
        print(f"Hit Rate:           {report['hit_rate']} (good queries matched)")
        print(f"False Positive:     {report['false_positive_rate']} (bad queries wrongly matched)")
        print(f"Avg Similarity:     {report['avg_similarity']}")
        print("-" * 70)
        
        if report["ready_for_production"]:
            print("🚀 STATUS: READY FOR PRODUCTION")
        else:
            print("⚠️  STATUS: NOT READY - Fix failed tests before deploying")
            print("\nFailed Tests:")
            for t in report["failed_tests"]:
                print(f"  • {t['query'][:50]} - {t['reason']}")
        
        print("=" * 70 + "\n")
        
        return report


def check_api_health(api_url: str) -> bool:
    """Check if RAG API is running"""
    try:
        response = requests.get(f"{api_url}/health", timeout=5)
        return response.ok
    except:
        return False


def get_available_agents(api_url: str) -> List[Dict]:
    """Get list of available agents"""
    try:
        response = requests.get(f"{api_url}/api/agents", timeout=5)
        if response.ok:
            return response.json().get("agents", [])
    except:
        pass
    return []


def main():
    parser = argparse.ArgumentParser(description="RAG Quality Testing Suite")
    parser.add_argument("--agent-id", help="Agent ID to test", required=False)
    parser.add_argument("--api-url", default=RAG_API_URL, help="RAG API URL")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    parser.add_argument("--list-agents", action="store_true", help="List available agents")
    args = parser.parse_args()
    
    # Check API health
    if not check_api_health(args.api_url):
        print(f"❌ ERROR: RAG API not responding at {args.api_url}")
        print("Make sure the API is running: python -m uvicorn api:app --port 8000")
        return
    
    print(f"✅ RAG API is running at {args.api_url}")
    
    # List agents if requested
    if args.list_agents or not args.agent_id:
        agents = get_available_agents(args.api_url)
        if agents:
            print("\nAvailable Agents:")
            for agent in agents:
                print(f"  • {agent.get('name', 'Unknown')}: {agent['id']}")
            
            if not args.agent_id:
                print("\nRun with: python test_rag.py --agent-id <AGENT_ID>")
                return
        else:
            print("No agents found in database.")
            return
    
    # Run tests
    tester = RAGTester(
        agent_id=args.agent_id,
        api_url=args.api_url,
        verbose=args.verbose
    )
    
    report = tester.run_all_tests()
    
    # Save report to file
    report_file = f"rag_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, "w") as f:
        json.dump(report, f, indent=2)
    print(f"📄 Report saved to: {report_file}")


if __name__ == "__main__":
    main()
