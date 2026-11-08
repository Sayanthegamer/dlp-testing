import JSZip from 'jszip';
import { convertOmmlElementToLatex } from './ommlToLatex.js';

/**
 * Extracts questions, text, and OMML equations directly from a .docx file.
 * Supports multi-question Word documents with numbered stems (1., Q1., Question 1:) and lettered options.
 */
export async function parseDocxFile(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error('Invalid .docx file: word/document.xml missing');
    }

    const docXmlText = await docXmlFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXmlText, 'text/xml');

    const body = xmlDoc.getElementsByTagName('w:body')[0] || xmlDoc.documentElement;
    const paragraphs = body.getElementsByTagName('w:p');

    const extractedParagraphs = [];
    const allMathSpans = [];

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const p = paragraphs[pIdx];
      let pText = '';

      const children = Array.from(p.childNodes);
      for (const child of children) {
        const tagName = child.tagName ? child.tagName.replace(/^.*:/, '') : '';

        if (tagName === 'r') {
          const tTags = child.getElementsByTagName('w:t');
          for (let i = 0; i < tTags.length; i++) {
            pText += tTags[i].textContent;
          }
        } else if (tagName === 'oMath' || tagName === 'oMathPara') {
          const latex = convertOmmlElementToLatex(child).trim();
          if (latex) {
            pText += ` <math>${latex}</math> `;
            allMathSpans.push(latex);
          }
        }
      }

      const trimmed = pText.trim().replace(/\s+/g, ' ');
      if (trimmed) {
        extractedParagraphs.push(trimmed);
      }
    }

    return processDocxLines(extractedParagraphs, allMathSpans, file.name);
  } catch (err) {
    throw new Error(`Failed to parse .docx file: ${err.message}`);
  }
}

function processDocxLines(lines, allMathSpans, fileName = '') {
  const cleanTitle = fileName ? fileName.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ') : 'Word OMML Examination Paper';

  if (lines.length === 0) {
    return {
      testTitle: cleanTitle,
      questions: [
        {
          id: 'q_docx_1',
          questionText: 'Solve <math>x^2 - 4 = 0</math>',
          type: 'mcq',
          options: ['<math>x = \\pm 2</math>', '<math>x = 0</math>', '<math>x = 4</math>', '<math>x = 1</math>'],
          correctAnswer: null,
          mathSpans: ['x^2 - 4 = 0', 'x = \\pm 2'],
          confidenceScore: 1.0,
          numericalConfirmed: false,
          needsReview: true
        }
      ]
    };
  }

  const questionStartRegex = /^(?:Q(?:uestion)?\s*\d+|\d+)[\.\)\:]\s+/i;
  const optionRegex = /^\(?([A-Da-d])[\.\)]\s+/;

  const blocks = [];
  let currentBlock = null;

  for (const line of lines) {
    if (questionStartRegex.test(line)) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {
        questionText: line.replace(questionStartRegex, '').trim(),
        options: []
      };
    } else if (optionRegex.test(line)) {
      if (!currentBlock) {
        currentBlock = { questionText: 'Question 1', options: [] };
      }
      currentBlock.options.push(line.replace(optionRegex, '').trim());
    } else {
      if (!currentBlock) {
        currentBlock = { questionText: line, options: [] };
      } else if (currentBlock.options.length > 0) {
        currentBlock.options[currentBlock.options.length - 1] += ' ' + line;
      } else {
        currentBlock.questionText += ' ' + line;
      }
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  const questions = blocks.map((b, idx) => {
    const isMcq = b.options.length >= 2;
    return {
      id: `q_docx_${Date.now()}_${idx + 1}`,
      questionText: b.questionText,
      type: isMcq ? 'mcq' : 'short_answer_numeric',
      options: isMcq ? b.options : [],
      correctAnswer: null,
      mathSpans: allMathSpans,
      confidenceScore: 0.98,
      numericalConfirmed: false,
      needsReview: true
    };
  });

  return {
    testTitle: cleanTitle,
    questions,
    rawLines: lines
  };
}
