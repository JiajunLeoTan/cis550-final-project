import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from '../src/context/CartContext.jsx';

export function renderWith(ui, { route = '/', wrapCart = true, routes } = {}) {
  const inner = wrapCart ? <CartProvider>{ui}</CartProvider> : ui;
  return render(
    <MemoryRouter initialEntries={[route]}>
      {routes ? (
        <Routes>
          {routes.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
        </Routes>
      ) : (
        inner
      )}
    </MemoryRouter>
  );
}

export function renderWithRoute(element, { path, route, wrapCart = true } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {wrapCart ? (
        <CartProvider>
          <Routes>
            <Route path={path} element={element} />
          </Routes>
        </CartProvider>
      ) : (
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      )}
    </MemoryRouter>
  );
}
