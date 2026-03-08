import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import styles from './Result.module.css';

function Result() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  
  const [playerData, setPlayerData] = useState(null);
  const [isTestActive, setIsTestActive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        // 1. Próbujemy pobrać dane o wyniku gracza
        const { data: resData, error: resError } = await supabase
          .from('results')
          .select('*')
          .eq('id', resultId)
          .single();

        // --- NOWOŚĆ: AUTOMATYCZNY POWRÓT ---
        // Jeśli baza zwróci błąd (bo wiersz został usunięty przez "Nową grupę")
        // lub nie ma danych, to znaczy, że sesja wygasła.
        if (resError || !resData) {
          console.log("Sesja wygasła lub została zresetowana przez nauczyciela.");
          if (isMounted) {
            navigate('/'); // Wracaj na start!
          }
          return;
        }

        // 2. Pobierz status testu (czy nauczyciel już skończył)
        const { data: settings } = await supabase
          .from('settings')
          .select('is_test_active')
          .eq('id', 1)
          .single();

        if (isMounted) {
          setPlayerData(resData);
          if (settings) setIsTestActive(settings.is_test_active);
          setLoading(false);
        }
      } catch (err) {
        console.error("Błąd synchronizacji:", err);
      }
    };

    fetchStatus();

    // Sprawdzaj co 2 sekundy
    const interval = setInterval(fetchStatus, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [resultId, navigate]);

  if (loading || !playerData) {
    return <div className={styles.loading}>Synchronizacja wyników...</div>;
  }

  // EKRAN 1: OCZEKIWANIE
  if (isTestActive) {
    return (
      <div className={`animate-fade-in ${styles.card}`}>
        <div className={styles.spinner}>⏳</div>
        <h2 className={styles.title}>Dobra robota, {playerData.nickname}!</h2>
        <p className={styles.subtitle}>
          Ukończyłeś wszystkie pytania. Twój wynik został zapisany.<br/>
          <b>Poczekaj chwilę</b> – nauczyciel musi oficjalnie zakończyć test, aby pokazać wszystkim ranking.
        </p>
        <div className={styles.pulseBox}>Oczekiwanie na zakończenie...</div>
      </div>
    );
  }

  // EKRAN 2: WYNIK KOŃCOWY
  const percentage = Math.round((playerData.score / playerData.total_questions) * 100);
  let msg = "Gratulacje!";
  if (percentage === 100) msg = "Mistrzowski wynik!";
  else if (percentage < 40) msg = "Dzięki za udział!";

  return (
    <div className={`animate-fade-in ${styles.card}`}>
      <div className={styles.icon}>🏆</div>
      <h2 className={styles.title}>{msg}</h2>
      <p className={styles.subtitle}>Oficjalny ranking dla gracza: <span className={styles.highlight}>{playerData.nickname}</span></p>

      <div className={styles.scoreCircle}>
        <span className={styles.bigScore}>{playerData.score}</span>
        <span className={styles.totalScore}>/ {playerData.total_questions}</span>
      </div>

      <button onClick={() => navigate('/', { replace: true })} className={styles.button}>
        Zakończ i wróć na start
      </button>
    </div>
  );
}

export default Result;