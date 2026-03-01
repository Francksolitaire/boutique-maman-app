export const metadata = {
  title: 'Boutique Maman',
  description: 'Gestion de stock et commandes',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        {children}
      </body>
    </html>
  )
}
