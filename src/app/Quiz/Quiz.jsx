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
      // 1. Sprawdź status gracza
      const { data: gameData, error: gameError } = await supabase
        .from('results')
        .select('nickname, score, time_seconds') // dodano time_seconds
        .eq('id', resultId)
        .single();

      if (gameError || !gameData) {
        navigate('/', { replace: true });
        return;
      }

      // BLOKADA: Jeśli gracz ma już zapisany czas, oznacza to, że skończył test
      // Nie pozwalamy mu go robić ponownie - od razu do wyników
      if (gameData.time_seconds && gameData.time_seconds > 0) {
        navigate(`/result/${resultId}`, { replace: true });
        return;
      }

      // NOWOŚĆ: RESET PUNKTÓW W BAZIE PRZY ODŚWIEŻENIU
      // Jeśli ktoś odświeży stronę, zaczyna od 0 pkt i od 1 pytania
      await supabase
        .from('results')
        .update({ score: 0 }) 
        .eq('id', resultId);

      setNickname(gameData.nickname);
      setScore(0); // lokalnie też resetujemy do 0

      // 2. Pobierz pytania
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select('*');

      if (!qError && qData) {
        setQuestions(qData);
        await supabase
          .from('results')
          .update({ total_questions: qData.length })
          .eq('id', resultId);

        startTimeRef.current = Date.now();
      }
      
      setLoading(false);
    };

    initQuiz();
  }, [resultId, navigate]);

  // --- BLOKADA PRZYPADKOWEGO WYJŚCIA ---
  useEffect(() => {
    // 1. Blokada odświeżenia i zamknięcia karty (standardowe okno przeglądarki)
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = ''; // Wymagane przez nowsze przeglądarki
    };

    // 2. Blokada przycisku "Wstecz" na telefonach (dodanie sztucznej historii)
    window.history.pushState(null, null, window.location.pathname);
    const handlePopState = () => {
      const confirmExit = window.confirm("Czy na pewno chcesz przerwać test? Twoje postępy zostaną utracone.");
      if (confirmExit) {
        navigate('/', { replace: true });
      } else {
        // Jeśli nie chce wyjść, wracamy "do przodu" w historii
        window.history.pushState(null, null, window.location.pathname);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

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

      window.onbeforeunload = null;

      // Wysyłamy ostateczny wynik i czas
      await supabase
        .from('results')
        .update({ 
          score: newScore, 
          time_seconds: totalTimeSeconds 
        })
        .eq('id', resultId);

      navigate(`/result/${resultId}`, { replace: true });
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
          <span>Gracz: <b>{nickname}</b></span>
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

      <div className={styles.answersGrid} key={currentIndex}>
        {options.map((opt) => (
          <button 
            key={opt.letter}
            onClick={(e) => {
              // Dodatkowo usuwamy fokus z przycisku po kliknięciu
              e.currentTarget.blur(); 
              handleAnswer(opt.letter);
            }} 
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