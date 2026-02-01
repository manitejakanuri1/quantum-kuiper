// Test file to demonstrate CodeRabbit's test review capabilities
// This has issues that CodeRabbit should identify

describe('CodeRabbit Demo Tests', () => {
  // ISSUE 1: No test coverage for error cases
  it('should process valid input', () => {
    const result = processData({ name: 'test' });
    expect(result).toBe(true);
  });

  // ISSUE 2: Flaky test - depends on timing
  it('should complete async operation', async () => {
    setTimeout(() => {
      expect(true).toBe(true);
    }, 100);
  });

  // ISSUE 3: Unclear assertion
  it('should work', () => {
    const result = calculate(5, 10);
    expect(result).toBeTruthy(); // What should it actually be?
  });

  // ISSUE 4: No mock cleanup
  it('should use external API', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ data: 'test' }),
    } as Response);

    // Missing: afterEach cleanup
  });
});

// ISSUE 5: Missing function implementations (causing test to fail)
function processData(input: any) {
  return true;
}

function calculate(a: number, b: number) {
  return a + b;
}
