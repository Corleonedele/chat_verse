import './App.css';
import React from 'react';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    // useRouteMatch,
    // useParams
  } from "react-router-dom";
import ChatRoom from './components/ChatRoom/ChatRoom';
import Login from './components/Login/Login';
import Sign from './components/Sign/Sign';
import ChatRooms from './components/ChatRooms/ChatRooms';

export const API = '/api'

function App() {

    return (
        <div className="App">
            <Router>
                <Routes>
                    <Route path='/chatrooms' element={<ChatRooms />}/>
                    <Route path='/chatroom' element={<ChatRoom />}/>
                    <Route path='/login' element={<Login />} />
                    <Route path='/sign' element={<Sign />} />
                    <Route path='/' element={<Login />} />
                </Routes>
            </Router>
        </div>
    );
}

export default App;
