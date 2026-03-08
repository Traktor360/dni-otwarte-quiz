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
    const trimmedNick = nickname.trim();

    if (!trimmedNick) {
      setError('Proszę wpisać swój nick!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Sprawdź, czy test jest aktywny
      const { data: settings } = await supabase.from('settings').select('is_test_active').eq('id', 1).single();
      
      if (settings && !settings.is_test_active) {
        setError('Test jest obecnie zamknięty przez nauczyciela. Poczekaj na nową grupę.');
        setLoading(false);
        return;
      }

      // --- NOWOŚĆ: SPRAWDZANIE UNIKALNOŚCI NICKU ---
      const { data: existingUser } = await supabase
        .from('results')
        .select('nickname')
        .eq('nickname', trimmedNick)
        .maybeSingle(); // maybeSingle nie rzuca błędu, gdy nic nie znajdzie

      if (existingUser) {
        setError('Ten nick jest już zajęty! Wybierz inny.');
        setLoading(false);
        return;
      }
      // ----------------------------------------------

      // 2. Dodajemy gracza do tabeli players
      const { error: playerError } = await supabase
        .from('players')
        .insert([{ nickname: trimmedNick }])
        .select()
        .single();

      if (playerError) throw playerError;

      // 3. Tworzymy wpis w tabeli results
      const { data: resultData, error: resultError } = await supabase
        .from('results')
        .insert([{ 
          nickname: trimmedNick, 
          score: 0, 
          total_questions: 0 
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