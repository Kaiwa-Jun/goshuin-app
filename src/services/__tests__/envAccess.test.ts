import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * babel-preset-expo が EXPO_PUBLIC_* をビルド時にインライン化するのは
 * `process.env.NAME` のドット記法だけ。ブラケット記法（`process.env['NAME']`）や
 * 変数経由（`const env = process.env; env.NAME`）では置換されず、Metro 経由の
 * 開発では動くのに本番ビルドでだけ undefined になる。
 * 実際に v1.0.0 の production ビルドが起動時クラッシュした原因のため、静的に禁じる。
 */
const SRC_DIR = join(__dirname, '../..');

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' ? [] : collectSourceFiles(path);
    }
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('EXPO_PUBLIC_* の参照方法', () => {
  it('ブラケット記法や変数経由ではなくドット記法で参照している', () => {
    const violations: string[] = [];

    for (const file of collectSourceFiles(SRC_DIR)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
          // process.env['EXPO_PUBLIC_...'] / env['EXPO_PUBLIC_...'] / env.EXPO_PUBLIC_...
          const bracketAccess = /\benv\s*\[\s*['"`]EXPO_PUBLIC_/.test(line);
          const viaAlias =
            /\benv\.EXPO_PUBLIC_/.test(line) && !/\bprocess\.env\.EXPO_PUBLIC_/.test(line);
          if (bracketAccess || viaAlias) {
            violations.push(`${file.replace(SRC_DIR, 'src')}:${i + 1}: ${line.trim()}`);
          }
        });
    }

    expect(violations).toEqual([]);
  });

  it('process.env を変数に代入して使い回していない', () => {
    const violations = collectSourceFiles(SRC_DIR).filter(file =>
      /\b(const|let|var)\s+\w+\s*=\s*process\.env\s*;/.test(readFileSync(file, 'utf8'))
    );

    expect(violations.map(f => f.replace(SRC_DIR, 'src'))).toEqual([]);
  });
});
