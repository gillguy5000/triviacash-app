const fs = require('fs');
const axios = require('axios');

// Open Trivia Database API URL (Fetches 50 multiple choice questions)
const TRIVIA_API_URL = 'https://opentdb.com/api.php?amount=50&type=multiple';

async function fetchAndSaveQuestions() {
  console.log('Fetching questions from Open Trivia Database...');

  try {
    const response = await axios.get(TRIVIA_API_URL);
    const results = response.data.results;

    if (!results || results.length === 0) {
      console.log('No questions retrieved.');
      return;
    }

    // Transform API response into our app's question format
    const formattedQuestions = results.map((item) => {
      // Decode HTML entities (like &quot; or &#039;)
      const questionText = decodeURIComponent(encodeURIComponent(item.question))
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&');

      // Mix correct answer with incorrect options
      const options = [...item.incorrect_answers, item.correct_answer];
      
      // Shuffle options randomly
      const shuffledOptions = options
        .map((opt) => opt.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'))
        .sort(() => Math.random() - 0.5);

      // Find the index of the correct answer after shuffling
      const answerIndex = shuffledOptions.indexOf(
        item.correct_answer.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
      );

      return {
        category: item.category,
        q: questionText,
        options: shuffledOptions,
        answer: answerIndex
      };
    });

    // Save questions locally to a JSON file
    fs.writeFileSync('questions.json', JSON.stringify(formattedQuestions, null, 2));
    console.log(`Successfully fetched and saved ${formattedQuestions.length} questions to questions.json!`);

  } catch (error) {
    console.error('Error fetching questions:', error.message);
  }
}

fetchAndSaveQuestions();
