import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ProblemAnalysis {
  title: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  complexityGoal: string;
  approach: string;
  reasoning?: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
}

export interface AIResponse<T> {
  data: T;
  reasoning?: string;
}

export const analyzeProblem = async (problemDescription: string, includeReasoning: boolean = false): Promise<AIResponse<ProblemAnalysis>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this competitive programming problem and provide a structured breakdown. 
    ${includeReasoning ? "Include a detailed 'reasoning' field explaining your thought process and how you derived the approach." : ""}
    Problem: ${problemDescription}`,
    config: {
      thinkingConfig: { thinkingLevel: includeReasoning ? ThinkingLevel.HIGH : ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
          inputFormat: { type: Type.STRING },
          outputFormat: { type: Type.STRING },
          complexityGoal: { type: Type.STRING },
          approach: { type: Type.STRING },
          reasoning: { type: Type.STRING },
        },
        required: ["title", "constraints", "inputFormat", "outputFormat", "complexityGoal", "approach"],
      },
    },
  });

  const text = response.text || "{}";
  const jsonStr = text.replace(/```json|```/g, "").trim();
  let data: any = {};
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse analysis:", e);
  }
  return { data, reasoning: data.reasoning };
};

export const generateInitialCode = async (analysis: ProblemAnalysis, includeReasoning: boolean = false): Promise<AIResponse<string>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an elite Competitive Programming AI. Generate a Python solution for the following problem analysis:
    ${JSON.stringify(analysis, null, 2)}
    
    CORE DIRECTIVES:
    1. Fast I/O is Mandatory: Use \`sys.stdin.read().split()\` for reading inputs. Avoid standard \`input()\`.
    2. The 10^15 Packing Trick: When the problem requires prioritizing minimizing 'item count' before 'total cost' (or similar dual-objective optimization), you MUST use the packing trick. Combine the objectives into a single weight: \`combined_weight = item_count * 10**15 + total_cost\`. Optimize for \`combined_weight\`. After finding the optimal path/state, extract the original values using division and modulo operations.
    3. Complexity Constraints: Strictly adhere to the required Time and Memory complexity provided in the problem analysis.
    4. Robustness: Initialize variables carefully. Handle integer overflow. Beware of 0-indexed vs 1-indexed requirements.
    
    ${includeReasoning ? "Before the code, provide a brief 'reasoning' section wrapped in <reasoning> tags. Then provide the code." : "Return ONLY the Python code. No markdown formatting."}`,
    config: {
      thinkingConfig: { thinkingLevel: includeReasoning ? ThinkingLevel.HIGH : ThinkingLevel.LOW },
    }
  });

  const text = response.text || "";
  const reasoningMatch = text.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : undefined;
  
  let code = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/, "").trim();
  const codeMatch = code.match(/```(?:python)?\n([\s\S]*?)```/);
  if (codeMatch) {
    code = codeMatch[1].trim();
  } else {
    code = code.replace(/```python|```/g, "").trim();
  }

  return { data: code, reasoning };
};

export const generateTestCases = async (problemDescription: string, analysis: ProblemAnalysis, existingCode: string): Promise<TestCase[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an expert competitive programming tester.
    For a given problem, generate all important edge cases that may break incorrect solutions.
    
    CRITICAL INSTRUCTION: The expectedOutput MUST be 100% correct according to the Problem description. Do NOT base the expectedOutput on the provided Code if the Code is incorrect. Calculate the true expected output manually.
    
    Consider and include:
    - smallest possible input
    - largest possible input
    - special cases (all equal numbers)
    - negative numbers
    - zero values
    - sorted and reverse sorted inputs
    
    Return at least 10 hidden test cases with expected outputs.
    In the 'description' field, explain exactly WHY each edge case is important and what potential bug it tests for.
    
    Problem: ${problemDescription}
    Analysis: ${JSON.stringify(analysis)}
    Code for context: ${existingCode}`,
    config: {
      
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            input: { type: Type.STRING, description: "The raw input string for the test case." },
            expectedOutput: { type: Type.STRING, description: "The expected output string for the test case." },
            description: { type: Type.STRING, description: "Explanation of why this edge case is important and what it tests for." },
          },
          required: ["input", "expectedOutput", "description"],
        },
      },
    },
  });

  const text = response.text || "[]";
  const jsonStr = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse test cases:", e);
    return [];
  }
};

export const debugAndRepair = async (
  problemDescription: string,
  code: string,
  failedTests: any[],
  includeReasoning: boolean = false
): Promise<AIResponse<string>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an elite Competitive Programming AI repairing previously failed code.
    The following Python code failed some test cases. 
    Problem: ${problemDescription}
    Current Code: ${code}
    Failed Tests: ${JSON.stringify(failedTests, null, 2)}
    
    REPAIR DIRECTIVES:
    1. Analyze the Failed Tests carefully. Identify if the failure was a logical flaw (Wrong Answer), a performance issue (TLE), or a crash (RE).
    2. Ensure Fast I/O is used: \`sys.stdin.read().split()\`.
    3. If the problem requires dual-objective optimization (e.g., minimizing item count then total cost), ensure the 10^15 packing trick is implemented correctly: \`combined_weight = item_count * 10**15 + total_cost\`.
    
    ${includeReasoning ? "Before the code, provide a 'reasoning' section wrapped in <reasoning> tags explaining the bug and the fix. Then provide the FIXED Python code." : "Analyze the failures and provide the FIXED Python code. Return ONLY the code. No markdown formatting."}`,
    config: {
      thinkingConfig: { thinkingLevel: includeReasoning ? ThinkingLevel.HIGH : ThinkingLevel.LOW },
    }
  });

  const text = response.text || "";
  const reasoningMatch = text.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : undefined;
  
  let fixedCode = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/, "").trim();
  const codeMatch = fixedCode.match(/```(?:python)?\n([\s\S]*?)```/);
  if (codeMatch) {
    fixedCode = codeMatch[1].trim();
  } else {
    fixedCode = fixedCode.replace(/```python|```/g, "").trim();
  }

  return { data: fixedCode, reasoning };
};

export const optimizeCode = async (problemDescription: string, code: string, includeReasoning: boolean = false): Promise<AIResponse<string>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an expert algorithm analyzer.
    
    Given a piece of code, do the following:
    1. Identify the algorithm used.
    2. Determine time complexity.
    3. Determine space complexity.
    4. Check for logical bugs.
    5. Check for inefficiencies.
    6. Suggest optimized code if possible.
    
    Problem: ${problemDescription}
    Current Code: ${code}
    
    ${includeReasoning ? "Provide a step-by-step reasoning section wrapped in <reasoning> tags explaining your analysis for steps 1-5. Then provide the optimized Python code (step 6)." : "Analyze the code internally and return ONLY the optimized Python code. No markdown formatting."}`,
    config: {
      thinkingConfig: { thinkingLevel: includeReasoning ? ThinkingLevel.HIGH : ThinkingLevel.LOW },
    }
  });

  const text = response.text || "";
  const reasoningMatch = text.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : undefined;
  
  let optimizedCode = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/, "").trim();
  const codeMatch = optimizedCode.match(/```(?:python)?\n([\s\S]*?)```/);
  if (codeMatch) {
    optimizedCode = codeMatch[1].trim();
  } else {
    optimizedCode = optimizedCode.replace(/```python|```/g, "").trim();
  }

  return { data: optimizedCode, reasoning };
};

export const explainCode = async (problemDescription: string, code: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an expert competitive programming assistant.
    Your task is to analyze programming problems and solutions like a CodeVita or ICPC judge.
    
    For the problem and code provided below, you must:
    1. Understand the problem statement.
    2. Identify the algorithm used.
    3. Analyze time complexity and space complexity.
    4. Detect potential hidden test cases.
    5. Generate edge cases that might break the solution.
    6. Suggest improvements if the algorithm is not optimal.
    7. Verify correctness using logical reasoning.
    8. Suggest better algorithms if needed.
    
    Always respond in this EXACT format (use Markdown headers):
    ### 1. Problem Understanding
    ### 2. Algorithm Used
    ### 3. Time Complexity
    ### 4. Space Complexity
    ### 5. Edge Cases
    ### 6. Hidden Test Cases
    ### 7. Possible Failures
    ### 8. Suggested Optimization
    
    Problem: ${problemDescription}
    Code: ${code}`,
  });

  return response.text || "No explanation generated.";
};
