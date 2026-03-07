
import React from 'react';
import { Link } from 'react-router-dom';
import { songs } from '../data/songs';

const Library = () => {
  return (
    <div className='bg-gray-900 text-white min-h-screen p-8'>
      <div className='max-w-3xl mx-auto'>
        <h1 className='text-4xl font-bold mb-8 border-b border-gray-700 pb-4'>
          Sua Biblioteca de Músicas
        </h1>
        <ul className='list-none p-0'>
          {songs.map((song) => (
            <Link to={`/song/${song.id}`} key={song.id} className='no-underline text-inherit'>
              <li className='bg-gray-800 mb-4 p-6 rounded-lg cursor-pointer transition-colors hover:bg-gray-700'>
                <h2 className='text-2xl font-semibold'>{song.title}</h2>
                <p className='text-gray-400 mt-1'>{song.artist}</p>
              </li>
            </Link>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Library;
