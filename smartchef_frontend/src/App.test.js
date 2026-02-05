import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AppStateProvider } from "./state/AppStateContext";

function renderAt(route) {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </AppStateProvider>
  );
}

test("renders Search screen", () => {
  renderAt("/");
  expect(screen.getByText(/SmartChef/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Search recipes/i })).toBeInTheDocument();
});

test("renders Favorites screen", () => {
  renderAt("/favorites");
  expect(screen.getByRole("heading", { name: /Favorites/i })).toBeInTheDocument();
});

test("renders Grocery list screen", () => {
  renderAt("/grocery");
  expect(screen.getByRole("heading", { name: /Grocery list/i })).toBeInTheDocument();
});
