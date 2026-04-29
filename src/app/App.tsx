import { RouterProvider } from 'react-router';
import { router } from './routes';

function App() {
  return (
    <div className="min-h-screen bg-[#0D1B2A]">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
