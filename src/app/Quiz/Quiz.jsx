import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import styles from './Quiz.module.css';

function Quiz() {
  const { resultId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  
  // Używamy useRef do przechowywania czasu startu - nie wywołuje re-renderów
  // i jest bezpieczniejsze dla lintera
  const startTimeRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    const initQuiz = async () => {
      // 1. Sprawdź czy taki gracz/wynik istnieje
      const { data: gameData, error: gameError } = await supabase
        .from('results')
        .select('nickname, score')
        .eq('id', resultId)
        .single();

      if (gameError || !gameData) {
        navigate('/');
        return;
      }

      setNickname(gameData.nickname);
      setScore(gameData.score);

      // 2. Pobierz pytania
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select('*');

      if (!qError && qData) {
        setQuestions(qData);
        
        // 3. Aktualizacja łącznej liczby pytań
        await supabase
          .from('results')
          .update({ total_questions: qData.length })
          .eq('id', resultId);

        // Zapisujemy czas startu w refie
        startTimeRef.current = Date.now();
      }
      
      setLoading(false);
    };

    initQuiz();
  }, [resultId, navigate]);

  // Owijamy handleAnswer w useCallback, aby oddzielić logikę od renderowania
  const handleAnswer = useCallback(async (selectedAnswer) => {
    const currentQuestion = questions[currentIndex];
    let newScore = score;
    const isCorrect = selectedAnswer === currentQuestion.correct_answer;

    if (isCorrect) {
      newScore = score + 1;
      setScore(newScore);
    }

    const isLastQuestion = currentIndex + 1 >= questions.length;

    if (isLastQuestion) {
      // Obliczamy czas końcowy
      const now = Date.now();
      const start = startTimeRef.current || now;
      const totalTimeSeconds = Math.floor((now - start) / 1000);

      // Wysyłamy ostateczny wynik i czas
      await supabase
        .from('results')
        .update({ 
          score: newScore, 
          time_seconds: totalTimeSeconds 
        })
        .eq('id', resultId);

      navigate(`/result/${resultId}`);
    } else {
      // Aktualizacja wyniku w trakcie
      if (isCorrect) {
        await supabase
          .from('results')
          .update({ score: newScore })
          .eq('id', resultId);
      }
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, questions, score, resultId, navigate]);

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner}></div>
        <p>Inicjalizacja wyścigu...</p>
      </div>
    );
  }

  const question = questions[currentIndex];
  if (!question) return null;

  const progressPercentage = ((currentIndex + 1) / questions.length) * 100;

  const options = [
    { letter: 'A', text: question.answer_a },
    { letter: 'B', text: question.answer_b },
    { letter: 'C', text: question.answer_c },
    { letter: 'D', text: question.answer_d },
  ];

  return (
    <div className={`animate-fade-in ${styles.quizCard}`}>
      <div className={styles.progressContainer}>
        <div className={styles.progressHeader}>
          <span className={styles.playerTag}>Gracz: <b>{nickname}</b></span>
          <span>Pytanie {currentIndex + 1} / {questions.length}</span>
        </div>
        <div className={styles.progressBarBg}>
          <div 
            className={styles.progressBarFill} 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>
      
      <div className={styles.questionArea}>
        <h2 className={styles.questionText}>{question.question}</h2>
      </div>

      <div className={styles.answersGrid}>
        {options.map((opt) => (
          <button 
            key={opt.letter}
            onClick={() => handleAnswer(opt.letter)} 
            className={styles.answerBtn}
          >
            <span className={styles.letterBadge}>{opt.letter}</span>
            <span className={styles.answerText}>{opt.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Quiz;