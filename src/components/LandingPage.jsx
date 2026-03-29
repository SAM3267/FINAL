import { useState } from 'react';
import { Center, Stack, Title, Button, Image, Text, TextInput } from '@mantine/core';
import heroImage from '../assets/image_1.png'; 
import bgLand from '../assets/background_land.png'; 

const floatingKeyframes = `
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
    100% { transform: translateY(0px); }
  }
`;

export default function LandingPage({ onEnterApp }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onEnterApp(name.trim());
    }
  };

  return (
    <Center 
      style={{ 
        width: '100%', // תוקן מ-100vw כדי למנוע חריגות ופס גלילה
        height: '100vh', 
        overflow: 'hidden', // חוסם גלילה מיותרת מהאנימציות
        backgroundImage: `url(${bgLand})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'
      }}
    >
      <style>{floatingKeyframes}</style>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1 }} />

      <Stack align="center" gap="xl" style={{ zIndex: 2 }}> 
        <div style={{ animation: 'float 3s ease-in-out infinite', display: 'flex', justifyContent: 'center', filter: 'drop-shadow(0px 10px 15px rgba(0,0,0,0.3))' }}>
          <Image src={heroImage} alt="Neptune Logo" w={200} h={200} fit="contain" />
        </div>
        
        <Stack align="center" gap={5}>
          <Title order={1} size="42px" c="white" style={{ letterSpacing: '-1px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            neptuneManager
          </Title>
          <Text c="gray.2" fw={500} size="lg" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            מערכת ניהול חוקי הניטור של AMAN
          </Text>
        </Stack>
        
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '300px' }}>
          <Stack>
            <TextInput 
              placeholder="הזן את שמך כדי להתחיל..." 
              size="lg" radius="xl" required
              value={name} onChange={(e) => setName(e.currentTarget.value)}
              styles={{ input: { textAlign: 'center' } }}
            />
            <Button type="submit" variant="filled" color="blue" size="xl" radius="xl" disabled={!name.trim()}>
              היכנס למערכת
            </Button>
          </Stack>
        </form>
      </Stack>
    </Center>
  );
}