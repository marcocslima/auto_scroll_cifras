
import React from 'react';

const Dashboard = () => {
  return (
    <div className="bg-gray-900 text-white min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Painel de Administração</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Exemplo de Card de Ação */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-2">Gerenciar Músicas</h2>
          <p className="text-gray-400 mb-4">Adicionar, editar ou remover músicas e cifras.</p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            Acessar
          </button>
        </div>

        {/* Outros cards podem ser adicionados aqui */}

      </div>
    </div>
  );
};

export default Dashboard;
