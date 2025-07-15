import React, { useState, useEffect } from 'react';
import { Paperclip, SendHorizontal } from 'lucide-react';
import { AzureOpenAI } from 'openai';
import mammoth from 'mammoth';


interface Assistant {
  id: string;
  name: string;
}

function markdownBoldToHtml(raw: string): string {
  if (typeof raw !== 'string') return '';

  // Replace all **text** with <strong>text</strong>
  // Use a global regex with non-greedy matching
  return raw.replace(/\*\*(.+?)\*\*/g, (_, boldText) => `<strong>${boldText}</strong>`);
}


function App() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [fileName, setFileName] = useState("");
  const [useCase, setUseCase] = useState('discharge');
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedAssistant, setSelectedAssistant] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  const client = new AzureOpenAI({
    endpoint: "https://dev-tuhi-clinicalnotesynthesis.openai.azure.com",
    apiVersion: "2024-05-01-preview",
    apiKey: "149096a4341942e186e76793d516c568",
    dangerouslyAllowBrowser: true
  });

  useEffect(() => {
    if (useCase === 'tuhi') {
      console.log('Fetching assistants...');
      fetchAssistants();
    }
  }, [useCase]);

  const fetchAssistants = async () => {
    try {
      const response = await fetch(
        `https://dev-tuhi-clinicalnotesynthesis.openai.azure.com/openai/assistants?api-version=${client.apiVersion}`,
        {
          headers: {
            'api-key': client.apiKey,
            'Content-Type': 'application/json'
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const devAssistants = data.data.filter((assistant: Assistant) => 
        assistant.name.startsWith('dev')
      );
      // console.log(devAssistants);
      setAssistants(devAssistants);
      if (devAssistants.length > 0) {
        setSelectedAssistant(devAssistants[0].id);
      }
    } catch (error) {
      console.error("Error fetching assistants:", error);
      setAssistants([]);
    }
  };

  const handleProcess = async () => {
    if (!input.trim()) return;
    
    setIsProcessing(true);
    setResult('Processing...');
    try {
      const assistantThread = await client.beta.threads.create({});
      const threadId = assistantThread.id;  

      await client.beta.threads.messages.create(
        threadId,
        {
          role: "user",
          content: input,
        }
      );
      
      const useCaseAssistantMap = {
        discharge: "asst_DeyRWVjRQjW4dyU5Zhicf8Vl",
        review: "asst_6erSDGc8VagbJqzt6RWPT9t0", 
        summary: "asst_5r1zDFF5azJdrE9XLHcewtyg",
        dev_CommunicationReview: "asst_VntAx623DnQiaLaRrfW7rAWF"// Add your new assistant here
      };

      // Choose assistant ID based on use case, otherwise fall back to manually selected assistant
      const assistantId = useCaseAssistantMap[useCase] || selectedAssistant;
      
      {/*
      const assistantId = 
        useCase === 'discharge' 
          ? "asst_DeyRWVjRQjW4dyU5Zhicf8Vl"
          : useCase === 'review'
          ? "asst_6erSDGc8VagbJqzt6RWPT9t0"
          : useCase === 'summary'
          ? "asst_5r1zDFF5azJdrE9XLHcewtyg"
          : useCase === 'dev_CommunicationReview'
          ? "asst_VntAx623DnQiaLaRrfW7rAWF"
          : selectedAssistant;
      */}
      console.log("Assts ID", assistantId);
      const runResponse = await client.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
      });

      let runStatus = runResponse.status;
      let runId = runResponse.id;

      while (runStatus === 'queued' || runStatus === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 8000));
        const runStatusResponse = await client.beta.threads.runs.retrieve(
          threadId,
          runId
        );
        runStatus = runStatusResponse.status;
      }

      if (runStatus === 'completed') {
        const messages = await client.beta.threads.messages.list(threadId);
        const lastMessage = messages.data.filter(msg => msg.role === "assistant" && msg.content && msg.content.length > 0).map(msg => msg.content[0].text.value);
        if (lastMessage) {
          if (assistantId === "asst_5r1zDFF5azJdrE9XLHcewtyg") {
            setResult(lastMessage.join('\n'));
          } else {
          setResult(lastMessage); // or however you normally get the full result
          }
        } else {
          setResult("No response content available");
        }
      } else {
        setResult(`Run ended with status: ${runStatus}`);
      }
    } catch (error) {
      console.error("Error during process:", error);
      setResult(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setInput('');
    setResult('');
    setFileName('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
  
    setFile(selectedFile);
  
    const reader = new FileReader();
  
    if (selectedFile.name.endsWith(".docx")) {
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        try {
          const result = await mammoth.extractRawText({ arrayBuffer });
          setInput((prevInput) => `${prevInput}\n\n${result.value}`);
        } catch (error) {
          console.error("Error extracting text from .docx:", error);
          setInput((prevInput) => `${prevInput}\n\n[Could not extract text from file]`);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else if (selectedFile.type.startsWith("text/")) {
      reader.onload = (e) => {
        const fileContent = e.target?.result as string;
        setInput((prevInput) => `${prevInput}\n\n${fileContent}`);
      };
      reader.readAsText(selectedFile);
    } else {
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        setInput((prevInput) => `${prevInput}\n\n[File Uploaded: ${selectedFile.name}, Base64: ${base64String.substring(0, 100)}...]`);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const getUseCaseTitle = () => {
    switch (useCase) {
      case 'discharge':
        return 'Analyse the Discharge Summary Report to extract and identify SNOMED CT procedure code';
      case 'tuhi':
        return 'Analyze the medical consultation and generate an enhanced transcript based on selected template';
      case 'review':
        return 'Add your clinical review meetings and case history to produce a draft learning review report'
      case 'summary':
        return 'AI generate Discharge Summary'
      case 'dev_CommunicationReview':
        return 'Review a consultation to get feedback on your communication'
      default:
        return 'Select a use case';
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header Card */}
        <div className="bg-gradient-to-r from-sky-800 to-cyan-600 text-white p-6 rounded-lg shadow-sm mb-8">
          <h1 className="text-xl font-medium">{getUseCaseTitle()}</h1>
        </div>

        {/* Use Case Selection */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-3">Select Your Use Case</h2>
          <div className="flex space-x-4">
            <select
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4D5C] focus:border-transparent"
            >
              <option value="discharge">Discharge Summary Analysis</option>
              <option value="summary">AI Generating Discharge Summary</option>
              <option value="tuhi">Tuhi Transcripts Analysis</option>
              <option value="review">Learn Review Report</option>
              <option value="dev_CommunicationReview">Communication Review</option>
              
            </select>

            {useCase === 'tuhi' && (
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                <select
                  value={selectedAssistant}
                  onChange={(e) => setSelectedAssistant(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4D5C] focus:border-transparent"
                >
                  {assistants.map((assistant) => (
                    <option key={assistant.id} value={assistant.id}>
                      {assistant.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Input and Result Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Input</h2>
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter your text here..."
                  className="w-full h-[400px] p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1B4D5C] focus:border-transparent resize-none"
                />
                <div className="absolute bottom-4 left-4">
                  <input 
                    type="file"
                    accept=".txt,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-flex items-center text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    <Paperclip className="w-5 h-5 mr-2" />
                    <span>{fileName || "Attach a file"}</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-between">
                <button
                  onClick={handleProcess}
                  disabled={isProcessing || !input.trim()}
                  className={`flex items-center px-6 py-2 ${
                    isProcessing || !input.trim()
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#1B4D5C] hover:bg-[#153e4a]'
                  } text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1B4D5C]`}
                >
                  <SendHorizontal className="w-5 h-5 mr-2" />
                  {isProcessing ? 'Processing...' : 'Process'}
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Result Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Result</h2>
              <div className="bg-gray-50 p-4 rounded-lg h-[400px] overflow-auto">
                {result ? (
                  useCase === "summary" ? (
                    <div
                      className="prose max-w-none whitespace-pre-wrap text-gray-900"
                      dangerouslySetInnerHTML={{ __html: markdownBoldToHtml(result ?? '') }}
                    />
                  ) : (
                    <div className="prose max-w-none whitespace-pre-wrap text-gray-900">
                      {result}
                    </div>
                  )
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    Results will appear here
                  </div>
                )}
              {/*
                {result ? (
                  <div className="prose max-w-none">
                    {result}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    Results will appear here
                  </div>
                )}
              */}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Message */}
        <div className="mt-8 p-4 bg-sky-200 border border-cyan-100 rounded-lg text-sm text-cyan-900">
          Try out our AI Assistant, powered by Azure OpenAI, to explore how generative AI can support your work. 
          Test ideas, ask questions, and discover potential use cases in a safe sandbox environment. 
          If you find it useful, we can explore how to tailor it for your team's needs. <br/><br/>
          To share ideas or feedback, contact us at <a href="mailto:innovation@tewhatuora.govt.nz" className="underline">innovation@tewhatuora.govt.nz.</a>
        </div>
      </div>
    </div>
  );
}

export default App;
