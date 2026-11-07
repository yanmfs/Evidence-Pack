# Instalar o EvidencePack pelo Homebrew

No macOS, com o Homebrew instalado:

```sh
brew install --cask yanmfs/tap/evidencepack
```

Depois, abra o **EvidencePack** na pasta Aplicativos. O cask usa o DMG universal da release, com SHA-256 fixo, e atende Apple Silicon e Intel. A versão do aplicativo requer macOS 11 ou mais recente; o próprio Homebrew também precisa dar suporte à sua versão do sistema.

O instalador não abre o app nem muda as preferências dele. O app é um projeto pessoal, sem certificado pago da Apple. Se o sistema pedir confirmação, siga a seção **Primeira abertura** do [README](../README.md).

## Atualizar

```sh
brew update
brew upgrade --cask yanmfs/tap/evidencepack
```

## Desinstalar

```sh
brew uninstall --cask yanmfs/tap/evidencepack
```

A receita instala somente o aplicativo. Não há script de limpeza de preferências ou de dados do usuário.

## De onde vem o pacote

A receita fica no [tap do Yan Suzano](https://github.com/yanmfs/homebrew-tap/blob/main/Casks/evidencepack.rb), separado do catálogo principal do Homebrew. Ela aponta para uma versão fixa nas [releases deste projeto](https://github.com/yanmfs/Evidence-Pack/releases). O Homebrew confere o checksum antes de instalar.

Para manter a receita, publique a nova release e atualize `version`, nome do arquivo e `sha256` no cask. Não troque o arquivo de uma versão já publicada por outro conteúdo.
