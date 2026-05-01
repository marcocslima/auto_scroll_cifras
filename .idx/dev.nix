
{ pkgs, ... }: {
  # Adiciona o Python 3 e o gerenciador de pacotes Pip ao ambiente.
  # Isso garante que as ferramentas para executar nossos scripts e instalar
  # dependências estejam sempre disponíveis.
  packages = [
    pkgs.python3
    pkgs.pip
  ];
}
