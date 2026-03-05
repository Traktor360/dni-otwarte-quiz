import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import styles from './Home.module.css';

function Home() {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleStart = async (e) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('Proszę wpisać swój nick!');
      return;
    }

    setLoading(true);
    setError('');

    try {

      const { data: settings } = await supabase.from('settings').select('is_test_active').eq('id', 1).single();
      
      if (settings && !settings.is_test_active) {
        setError('Test jest obecnie zamknięty przez nauczyciela. Poczekaj na nową grupę.');
        setLoading(false);
        return;
      }
      // 1. Dodajemy gracza do tabeli players (dla licznika "Dołączyło")
      const { error: playerError } = await supabase
        .from('players')
        .insert([{ nickname }])
        .select()
        .single();

      if (playerError) throw playerError;

      // 2. NOWOŚĆ: Od razu tworzymy wpis w tabeli results z wynikiem 0
      // Dzięki temu Admin widzi ucznia zanim ten skończy test
      const { data: resultData, error: resultError } = await supabase
        .from('results')
        .insert([{ 
          nickname, 
          score: 0, 
          total_questions: 0 // Zaktualizujemy to w Quiz.jsx jak pobierzemy pytania
        }])
        .select()
        .single();

      if (resultError) throw resultError;
      
      navigate(`/quiz/${resultData.id}`);
    } catch (err) {
      setError('Błąd połączenia. Spróbuj ponownie.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <div className={styles.card}>
        <div className={styles.glow}></div>
        <div className={styles.iconContainer}>
          <span className={styles.rocket}>🚀</span>
        </div>
        
        <h2 className={styles.title}>Witaj w wyzwaniu!</h2>
        <p className={styles.description}>
          Twoje wyniki będą aktualizowane na żywo na ekranie nauczyciela. 
          Pokaż na co Cię stać!
        </p>
        
        <form onSubmit={handleStart} className={styles.form}>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              placeholder="Wpisz swój nick..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={styles.input}
              maxLength={20}
            />
            <div className={styles.inputFocus}></div>
          </div>
          
          {error && <p className={styles.error}>{error}</p>}
          
          <button type="submit" className={styles.button} disabled={loading}>
            <span>{loading ? 'Łączenie...' : 'Wchodzę do gry'}</span>
            <div className={styles.btnEffect}></div>
          </button>
        </form>
      </div>
    </div>
  );
}
export default Home;