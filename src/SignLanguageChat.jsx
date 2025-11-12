import React, { useState, useRef } from 'react';
import { Upload, Send, Video, MessageSquare, User, UserCircle, Loader2, Play, AlertCircle, Camera, StopCircle, Mic, Volume2 } from 'lucide-react';

export default function SignLanguageChat() {
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const videoStreamRef = useRef(null);
  const audioStreamRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const chunksRef = useRef([]);
  const audioChunksRef = useRef([]);

  // Convert audio to text using Web Speech API
  const convertAudioToText = async (audioBlob) => {
    return new Promise((resolve, reject) => {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      recognition.onstart = () => {
        audio.play();
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };

      recognition.onerror = (event) => {
        reject(new Error('Speech recognition error: ' + event.error));
      };

      recognition.start();
    });
  };

  // Text to speech function
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Convert video to text using Gemini API via backend
  const convertVideoToText = async (videoFile) => {
    setIsProcessing(true);
    setError(null);
    try {
      const base64Video = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(videoFile);
      });

      const response = await fetch("/api/video-to-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "You are a sign language interpreter AI. Analyze this video/image and describe what sign language gestures you can observe. Based on the visual cues, body language, and hand movements, provide a natural text translation of what the person is trying to communicate. Be conversational and natural in your interpretation. Give only the translated text, nothing else."
              },
              {
                inline_data: {
                  mime_type: videoFile.type,
                  data: base64Video
                }
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Video to text response:", data);
      const convertedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Could not interpret the sign language.";

      return convertedText;
    } catch (error) {
      console.error("Error converting video:", error);
      setError("Make sure backend is running on port 5000: node server.js");
      return `Error: ${error.message}`;
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate sign language animation using Gemini API via backend
  const generateSignLanguageAnimation = async (text) => {
    setIsProcessing(true);
    setError(null);
    try {
      console.log("Generating animation for:", text);
      
      const response = await fetch("/api/text-to-animation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create a complete HTML5 Canvas animation for American Sign Language (ASL) signs for: "${text}"

Requirements:
1. Create a stick figure with detailed hands showing 5 fingers each
2. Animate ASL hand shapes for each word
3. Show clear finger movements
4. Add movement arrows
5. Display the word being signed
6. Use vibrant colors
7. Loop the animation
8. Canvas size: 600x400px

IMPORTANT: Return ONLY pure HTML code. Do NOT include any markdown formatting like \`\`\`html or \`\`\`. Start directly with <!DOCTYPE html> and end with </html>. No explanations, just the HTML code.

The HTML should include:
- Complete <!DOCTYPE html> declaration
- <head> with <style> for styling
- <body> with <canvas> element
- <script> with animation code
- Stick figure with visible fingers
- Smooth animation loop
- Text showing current word`
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend response error:", errorText);
        throw new Error(`Backend error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Animation response:", data);
      
      if (!data.candidates || !data.candidates[0]) {
        throw new Error("No response from Gemini API");
      }

      let htmlCode = data.candidates[0].content.parts[0].text;
      console.log("Raw HTML received (first 200 chars):", htmlCode.substring(0, 200));

      // Clean up the HTML code - remove any markdown formatting
      htmlCode = htmlCode
        .replace(/```html\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();

      // Check if HTML starts correctly
      if (!htmlCode.toLowerCase().startsWith('<!doctype') && !htmlCode.toLowerCase().startsWith('<html')) {
        console.warn("HTML doesn't start with DOCTYPE, adding it...");
        htmlCode = '<!DOCTYPE html>\n' + htmlCode;
      }

      console.log("Cleaned HTML (first 200 chars):", htmlCode.substring(0, 200));

      return htmlCode;
    } catch (error) {
      console.error("Error generating animation:", error);
      setError(`Animation error: ${error.message}`);
      return `<html><body style="display:flex;align-items:center;justify-content:center;height:100%;font-family:Arial;color:#ef4444;text-align:center;padding:20px;">
        <div>
          <h3>❌ Error generating animation</h3>
          <p>${error.message}</p>
          <p style="font-size:12px;color:#666;">Check browser console for details</p>
        </div>
      </body></html>`;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const tempMessage = {
        id: Date.now(),
        type: 'deaf',
        content: 'Processing video...',
        videoName: file.name,
        videoUrl: URL.createObjectURL(file),
        convertedText: 'Converting sign language to text...',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isProcessing: true
      };
      
      setMessages(prev => [...prev, tempMessage]);

      const convertedText = await convertVideoToText(file);

      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id 
          ? { ...msg, convertedText, isProcessing: false }
          : msg
      ));
    }
  };

  const handleTextSend = async () => {
    if (textInput.trim()) {
      const tempMessage = {
        id: Date.now(),
        type: 'normal',
        content: textInput,
        animationHtml: null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isProcessing: true
      };
      
      setMessages(prev => [...prev, tempMessage]);
      const currentText = textInput;
      setTextInput('');

      const animationHtml = await generateSignLanguageAnimation(currentText);

      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id 
          ? { ...msg, animationHtml, isProcessing: false }
          : msg
      ));
    }
  };

  // Start video recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      
      videoStreamRef.current = stream;
      chunksRef.current = [];
      
      // Show preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        setRecordedVideoUrl(URL.createObjectURL(blob));
        
        // Stop preview
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }
        
        // Stop all tracks
        if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach(track => track.stop());
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please grant camera permissions.');
    }
  };

  // Stop video recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Send recorded video
  const sendRecordedVideo = async () => {
    if (!recordedBlob) return;

    const tempMessage = {
      id: Date.now(),
      type: 'deaf',
      content: 'Processing recorded video...',
      videoName: `recording_${Date.now()}.webm`,
      videoUrl: recordedVideoUrl,
      convertedText: 'Converting sign language to text...',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isProcessing: true
    };
    
    setMessages(prev => [...prev, tempMessage]);

    // Convert blob to file
    const file = new File([recordedBlob], tempMessage.videoName, { type: 'video/webm' });
    const convertedText = await convertVideoToText(file);

    setMessages(prev => prev.map(msg => 
      msg.id === tempMessage.id 
        ? { ...msg, convertedText, isProcessing: false }
        : msg
    ));

    // Clear recorded video
    setRecordedBlob(null);
    setRecordedVideoUrl(null);
  };

  // Start audio recording
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudioBlob(blob);
        
        // Stop all audio tracks
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
        }

        // Process audio to text
        try {
          const transcript = await convertAudioToText(blob);
          
          const tempMessage = {
            id: Date.now(),
            type: 'normal',
            content: transcript,
            animationHtml: null,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isProcessing: true
          };
          
          setMessages(prev => [...prev, tempMessage]);
          const animationHtml = await generateSignLanguageAnimation(transcript);

          setMessages(prev => prev.map(msg => 
            msg.id === tempMessage.id 
              ? { ...msg, animationHtml, isProcessing: false }
              : msg
          ));
        } catch (err) {
          console.error('Error converting audio:', err);
          setError('Could not convert audio to text. Please try again.');
        }
        
        setRecordedAudioBlob(null);
      };
      
      audioRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecordingAudio(true);
      setError(null);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please grant microphone permissions.');
    }
  };

  // Stop audio recording
  const stopAudioRecording = () => {
    if (audioRecorderRef.current && isRecordingAudio) {
      audioRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-2 rounded-lg">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  SignBridge AI
                </h1>
                <p className="text-sm text-gray-600">Powered by Gemini 2.0 Flash</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="bg-indigo-100 p-2 rounded-full inline-block">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-xs text-gray-600 mt-1">Deaf User</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 p-2 rounded-full inline-block">
                  <UserCircle className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-xs text-gray-600 mt-1">User</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 max-w-6xl mx-auto w-full mt-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-full inline-block mb-4">
                <MessageSquare className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Start a Conversation</h2>
              <p className="text-gray-600 mb-4">
                Record video, upload, type, or speak
              </p>
              <div className="flex gap-2 justify-center text-sm text-gray-500 mb-3 flex-wrap">
                <span className="bg-red-100 px-3 py-1 rounded-full">📹 Record Video</span>
                <span className="bg-green-100 px-3 py-1 rounded-full">🎤 Voice</span>
                <span className="bg-indigo-100 px-3 py-1 rounded-full">Video → Text</span>
                <span className="bg-purple-100 px-3 py-1 rounded-full">Text → Animation</span>
              </div>
              <p className="text-xs text-gray-400">✨ Animations with detailed finger movements!</p>
              <p className="text-xs text-red-500 mt-2">⚠️ Backend must be running: node server.js</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'deaf' ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-2xl w-full ${message.type === 'deaf' ? 'mr-auto' : 'ml-auto'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {message.type === 'deaf' ? (
                      <>
                        <div className="bg-indigo-100 p-1.5 rounded-full">
                          <User className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Deaf User</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-gray-700">User</span>
                        <div className="bg-purple-100 p-1.5 rounded-full">
                          <UserCircle className="w-4 h-4 text-purple-600" />
                        </div>
                      </>
                    )}
                    <span className="text-xs text-gray-400">{message.timestamp}</span>
                  </div>
                  
                  {message.type === 'deaf' ? (
                    <div className="bg-white rounded-2xl shadow-md p-4 border-2 border-indigo-200">
                      <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg p-4 mb-3">
                        <div className="flex items-center gap-2 text-indigo-700 mb-2">
                          <Video className="w-5 h-5" />
                          <span className="font-medium text-sm">{message.videoName}</span>
                        </div>
                        {message.videoUrl ? (
                          <video 
                            src={message.videoUrl} 
                            controls 
                            className="w-full rounded-lg"
                            style={{ maxHeight: '300px' }}
                          />
                        ) : (
                          <div className="bg-indigo-600 h-32 rounded-lg flex items-center justify-center">
                            {message.isProcessing ? (
                              <Loader2 className="w-12 h-12 text-white animate-spin" />
                            ) : (
                              <Video className="w-12 h-12 text-white opacity-50" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-500">Converted Text:</p>
                          {!message.isProcessing && message.convertedText && (
                            <button
                              onClick={() => speakText(message.convertedText)}
                              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-xs transition-colors"
                            >
                              <Volume2 className="w-3 h-3" />
                              Listen
                            </button>
                          )}
                        </div>
                        {message.isProcessing ? (
                          <div className="flex items-center gap-2 text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Processing...</span>
                          </div>
                        ) : (
                          <p className="text-gray-700 whitespace-pre-wrap">{message.convertedText}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-md p-4 text-white">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="w-4 h-4" />
                        <p className="font-medium">{message.content}</p>
                      </div>
                      <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <Play className="w-5 h-5" />
                          <span className="text-sm font-medium">ASL Animation with Finger Details</span>
                        </div>
                        {message.isProcessing ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-10 h-10 animate-spin opacity-70" />
                            <p className="text-sm opacity-90">Generating detailed animation...</p>
                          </div>
                        ) : message.animationHtml ? (
                          <div className="bg-white rounded-lg overflow-hidden">
                            <iframe
                              srcDoc={message.animationHtml}
                              className="w-full border-0"
                              style={{ height: '450px', minHeight: '450px' }}
                              sandbox="allow-scripts"
                              title="Sign Language Animation"
                            />
                          </div>
                        ) : (
                          <div className="bg-white/90 text-gray-800 rounded-lg p-4 text-center">
                            Failed to generate animation
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="max-w-6xl mx-auto px-6 pb-2">
          <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Gemini AI is processing...</span>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t-2 border-gray-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deaf User Upload/Record */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border-2 border-indigo-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-indigo-100 p-1.5 rounded-full">
                  <User className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-800">Deaf User</h3>
              </div>
              
              {/* Video Preview while recording */}
              {isRecording && (
                <div className="mb-3 bg-white rounded-lg p-3 border-2 border-red-500">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                    <p className="text-xs font-medium text-red-700">Recording...</p>
                  </div>
                  <video 
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    className="w-full rounded-lg"
                    style={{ maxHeight: '200px' }}
                  />
                </div>
              )}

              {/* Recording Preview */}
              {recordedVideoUrl && !isRecording && (
                <div className="mb-3 bg-white rounded-lg p-3 border-2 border-indigo-300">
                  <p className="text-xs font-medium text-indigo-700 mb-2">Recorded Video:</p>
                  <video 
                    src={recordedVideoUrl} 
                    controls 
                    className="w-full rounded-lg mb-2"
                    style={{ maxHeight: '200px' }}
                  />
                  <button
                    onClick={sendRecordedVideo}
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Send Recording
                  </button>
                </div>
              )}

              {/* Recording Controls */}
              <div className="mb-3">
                {!isRecording && !recordedVideoUrl && (
                  <button
                    onClick={startRecording}
                    disabled={isProcessing}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-5 h-5" />
                    Start Recording
                  </button>
                )}
                
                {isRecording && (
                  <button
                    onClick={stopRecording}
                    className="w-full bg-gray-800 hover:bg-gray-900 text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 animate-pulse"
                  >
                    <StopCircle className="w-5 h-5" />
                    Stop Recording
                  </button>
                )}
              </div>

              {/* Upload Option */}
              {!isRecording && !recordedVideoUrl && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-indigo-300"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-indigo-50 px-2 text-gray-500">or</span>
                    </div>
                  </div>

                  <label className="cursor-pointer block mt-3">
                    <input
                      type="file"
                      accept="video/*,image/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                      disabled={isProcessing || isRecording}
                    />
                    <div className={`bg-white hover:bg-gray-50 transition-colors border-2 border-dashed border-indigo-300 rounded-lg p-4 text-center ${isProcessing || isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <Upload className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700">Upload Video/Image</p>
                      <p className="text-xs text-gray-500 mt-1">Gemini will convert to text</p>
                    </div>
                  </label>
                </>
              )}
            </div>

            {/* Normal User Input */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-purple-100 p-1.5 rounded-full">
                  <UserCircle className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-800">User</h3>
              </div>

              {/* Audio Recording Button */}
              <div className="mb-3">
                {!isRecordingAudio ? (
                  <button
onClick={startAudioRecording}
                    disabled={isProcessing}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mic className="w-5 h-5" />
                    Record Voice Message
                  </button>
                ) : (
                  <button
                    onClick={stopAudioRecording}
                    className="w-full bg-gray-800 hover:bg-gray-900 text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 animate-pulse"
                  >
                    <StopCircle className="w-5 h-5" />
                    Stop Recording
                  </button>
                )}
              </div>

              {/* Text Input */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-purple-300"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-purple-50 px-2 text-gray-500">or type</span>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isProcessing && handleTextSend()}
                  placeholder="Type your message..."
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-400 focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={handleTextSend}
                  disabled={isProcessing || !textInput.trim()}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">✨ Get detailed finger animations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}