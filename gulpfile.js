const { src, dest } = require('gulp');

// Copia os ícones (png/svg) das pastas de nodes/credentials para o dist,
// mantendo a mesma estrutura de diretórios que o n8n espera.
function buildIcons() {
	const nodeIcons = src('nodes/**/*.{png,svg}').pipe(dest('dist/nodes'));
	src('credentials/**/*.{png,svg}').pipe(dest('dist/credentials'));
	return nodeIcons;
}

exports['build:icons'] = buildIcons;
