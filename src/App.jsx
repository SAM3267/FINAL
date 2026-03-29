import { useState, useEffect } from 'react';
import { MantineProvider, createTheme, Center, Loader } from '@mantine/core'; 
import axios from 'axios';
import Dashboard from './components/Dashboard';
import { API_BASE_URL } from './config';

const theme = createTheme({ 
  direction: 'rtl',
  fontFamily: 'Calibri',
  headings: { fontFamily: 'Calibri' },
});

export default function App() {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/me`);
        setUserData(res.data); // השרת מחזיר: { username: 'ירדן', role: 'admin' }
      } catch (error) {
        console.error("Failed to fetch user", error);
        setUserData({ username: 'אורח', role: 'viewer' }); 
      }
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    window.location.reload();
  };

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <div dir="rtl" style={{ direction: 'rtl' }}>
        {!userData ? (
          <Center h="100vh" bg="#f8f9fa"><Loader size="xl" color="blue" /></Center>
        ) : (
          <Dashboard 
            onLogout={handleLogout} 
            username={userData.username} 
            userRole={userData.role} 
          />
        )}
      </div>
    </MantineProvider>
  );
}