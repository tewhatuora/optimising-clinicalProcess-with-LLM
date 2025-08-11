import React, { useState } from 'react';
import { Paperclip } from 'lucide-react';
import mammoth from 'mammoth';

interface FileUploadProps {
  onFileUploaded: (content: string, filename: string, isHtml: boolean) => void;
  fileName: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUploaded, fileName }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setIsUploading(true);

    const reader = new FileReader();

    if (selectedFile.name.endsWith(".docx")) {
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        try {
          // Extract HTML with embedded images and preserve formatting
          const result = await mammoth.convertToHtml({ 
            arrayBuffer,
            convertImage: mammoth.images.imgElement(function(image) {
              return image.read("base64").then(function(imageBuffer) {
                return {
                  src: "data:" + image.contentType + ";base64," + imageBuffer
                };
              });
            }),
            styleMap: [
              // Preserve table formatting
              "table => table.table.table-auto.border-collapse.border.border-gray-300",
              "tr => tr",
              "td => td.border.border-gray-300.px-2.py-1",
              "th => th.border.border-gray-300.px-2.py-1.bg-gray-100.font-semibold",
              // Preserve paragraphs and headings
              "p => p.mb-2",
              "h1 => h1.text-2xl.font-bold.mb-4",
              "h2 => h2.text-xl.font-semibold.mb-3",
              "h3 => h3.text-lg.font-semibold.mb-2",
              // Preserve lists
              "ul => ul.list-disc.ml-4.mb-2",
              "ol => ol.list-decimal.ml-4.mb-2",
              "li => li.mb-1"
            ]
          });
          
          // Call the callback with HTML content
          onFileUploaded(result.value, selectedFile.name, true);
          
          // Log any conversion messages for debugging
          if (result.messages.length > 0) {
            console.log("Document conversion messages:", result.messages);
          }
          
        } catch (error) {
          console.error("Error extracting content from .docx:", error);
          onFileUploaded(
            `[Error: Could not extract content from ${selectedFile.name}. Please try again or use a plain text file.]`, 
            selectedFile.name, 
            false
          );
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
      
    } else if (selectedFile.type.startsWith("text/")) {
      reader.onload = (e) => {
        const fileContent = e.target?.result as string;
        onFileUploaded(fileContent, selectedFile.name, false);
        setIsUploading(false);
      };
      reader.readAsText(selectedFile);
      
    } else {
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        onFileUploaded(
          `[File Uploaded: ${selectedFile.name}, Base64: ${base64String.substring(0, 100)}...]`, 
          selectedFile.name, 
          false
        );
        setIsUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    }

    // Reset the input value so the same file can be uploaded again
    event.target.value = '';
  };

  return (
    <>
      <input 
        type="file"
        accept=".txt,.doc,.docx,.pdf"
        onChange={handleFileUpload}
        className="hidden"
        id="file-upload"
        disabled={isUploading}
      />
      <label
        htmlFor="file-upload"
        className={`inline-flex items-center cursor-pointer ${
          isUploading 
            ? 'text-gray-400 cursor-not-allowed' 
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Paperclip className={`w-5 h-5 mr-2 ${isUploading ? 'animate-spin' : ''}`} />
        <span>
          {isUploading 
            ? 'Uploading...' 
            : fileName || "Attach a file"
          }
        </span>
      </label>
    </>
  );
};

export default FileUpload;
