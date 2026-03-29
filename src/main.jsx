import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';

// --- התיקון לשגיאה שלך: ייבוא של הקומפוננטה App ---
import App from './App'; 

// הגדרת ה-Theme עם Calibri
const theme = createTheme({
  // הגדרת הפונט הכללי (עם גיבויים למקרה שהפונט לא מותקן)
  fontFamily: 'Calibri',
  
  // הגדרת הפונט לכותרות
  headings: {
    fontFamily: 'Calibri',
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* עוטפים את הכל ב-Provider עם ה-theme החדש */}
    <MantineProvider theme={theme} defaultColorScheme="light">
      <App />
    </MantineProvider>
  </React.StrictMode>
);