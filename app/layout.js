import './globals.css';
export const metadata={
 title:'LIAR ROOM — кому ти віриш?',
 description:'Безкоштовна браузерна гра для друзів: один ведучий, п’ять підозрюваних і лише один брехун. Проєкт LemvoriLab.',
 openGraph:{title:'LIAR ROOM — кому ти віриш?',description:'Шестеро друзів. П’ять підказок. Один брехун.',images:['/social.svg']},
 robots:{index:true,follow:true}
};
export default function RootLayout({children}){return <html lang="uk"><body>{children}</body></html>;}
