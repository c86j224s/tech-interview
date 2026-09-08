import ghpages from 'gh-pages';

await new Promise((resolve, reject) => {
  ghpages.publish('dist', {
    branch: 'gh-pages',
    nojekyll: true,
    dotfiles: true,
    message: 'Deploy static interview site\n\nCo-Authored-By: Claude Code <noreply@anthropic.com>',
  }, (error) => error ? reject(error) : resolve());
});
console.log('gh-pages 브랜치에 정적 사이트를 게시했습니다. GitHub Pages의 배포 완료를 확인하세요.');
