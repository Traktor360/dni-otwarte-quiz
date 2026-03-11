export default function handler(req, res) {
  // Akceptujemy tylko metodę POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  // Pobieramy hasło ze zmiennej środowiskowej na serwerze
  const securePassword = import.meta.env.ADMIN_PASSWORD;

  if (!securePassword) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (password === securePassword) {
    // Hasło poprawne
    return res.status(200).json({ authenticated: true });
  } else {
    // Hasło błędne
    return res.status(401).json({ authenticated: false, message: 'Błędne hasło' });
  }
}