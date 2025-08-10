import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Document as DocxDocument, Packer, Paragraph } from 'docx';
import { saveAs } from 'file-saver';

interface DownloadButtonProps {
  resultContent: string;
  isResultEmpty: boolean;
}

// PDF Document Component
const PDFDocument = ({ content }: { content: string }) => {
  const styles = StyleSheet.create({
    page: {
      flexDirection: 'column',
      backgroundColor: '#FFFFFF',
      padding: 30,
    },
    section: {
      margin: 10,
      padding: 10,
      flexGrow: 1,
    },
    text: {
      fontSize: 12,
      textAlign: 'justify',
      fontFamily: 'Helvetica',
      lineHeight: 1.5,
    }
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.text}>{content}</Text>
        </View>
      </Page>
    </Document>
  );
};

const DownloadButton: React.FC<DownloadButtonProps> = ({ resultContent, isResultEmpty }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const downloadAsText = () => {
    const blob = new Blob([resultContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'result.txt');
    setIsDropdownOpen(false);
  };

  const downloadAsMarkdown = () => {
    const blob = new Blob([resultContent], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, 'result.md');
    setIsDropdownOpen(false);
  };

  const downloadAsPDF = async () => {
    try {
      const blob = await pdf(<PDFDocument content={resultContent} />).toBlob();
      saveAs(blob, 'result.pdf');
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const downloadAsWord = async () => {
    try {
      const doc = new DocxDocument({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: resultContent,
              }),
            ],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      saveAs(blob, 'result.docx');
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Error generating Word document:', error);
    }
  };

  const downloadOptions = [
    { label: 'Text (.txt)', action: downloadAsText },
    { label: 'Markdown (.md)', action: downloadAsMarkdown },
    { label: 'PDF (.pdf)', action: downloadAsPDF },
    { label: 'Word (.docx)', action: downloadAsWord },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isResultEmpty}
        className={`
          flex items-center justify-center
          w-10 h-10 rounded-lg border
          transition-colors duration-200
          ${isResultEmpty 
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
          }
        `}
        title={isResultEmpty ? 'No result to download' : 'Download result'}
      >
        <Download size={18} />
      </button>

      {isDropdownOpen && !isResultEmpty && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsDropdownOpen(false)}
          />
          
          <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="py-1">
              {downloadOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={option.action}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DownloadButton;
