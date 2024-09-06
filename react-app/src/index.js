import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react"; // Clerk integration

import { ModalProvider, Modal } from "./context/Modal";
import configureStore from "./store";
import * as sessionActions from "./store/session";
import App from "./App";

import "./index.css";

const store = configureStore();

if (process.env.NODE_ENV !== "production") {
	window.store = store;
	window.sessionActions = sessionActions;
}


const frontendApi = "your-clerk-frontend-api-key";

function Root() {
	return (
		<ClerkProvider frontendApi={frontendApi}>
			<ModalProvider>
				<Provider store={store}>
					<BrowserRouter>
						<App />
						<Modal />
					</BrowserRouter>
				</Provider>
			</ModalProvider>
		</ClerkProvider>
	);
}

ReactDOM.render(
	<React.StrictMode>
		<Root />
	</React.StrictMode>,
	document.getElementById("root")
);
