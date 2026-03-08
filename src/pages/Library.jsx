
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

const Library = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('title'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const songsData = [];
      querySnapshot.forEach((doc) => {
        songsData.push({ id: doc.id, ...doc.data() });
      });
      setSongs(songsData);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Não foi possível carregar as músicas.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <div className="container mx-auto p-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Biblioteca de Cifras</h1>

        {loading && <p className="text-center">Carregando...</p>}
        {error && <p className="text-center text-red-500">{error}</p>}

        {!loading && !error && (
          <div className="bg-gray-800 shadow-lg rounded-lg p-6">
            <ul className="divide-y divide-gray-700">
              {songs.length > 0 ? (
                songs.map(song => (
                  <li key={song.id} className="py-4">
                    <Link to={`/song/${song.id}`} className="block hover:bg-gray-700 p-4 rounded-lg transition-colors">
                      <h2 className="text-xl font-semibold text-blue-400">{song.title}</h2>
                      <p className="text-gray-400">{song.artist}</p>
                    </Link>
                  </li>
                ))
              ) : (
                <p className="text-center text-gray-400 py-4">Nenhuma música encontrada.</p>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
