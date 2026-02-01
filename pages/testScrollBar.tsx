// pages/testScrollBar.tsx

import React from "react";

export default function TestScrollBar() {
    return (
        <div
            style={{
                height: "300px",
                width: "100%",
                overflow: "auto",
                border: "2px solid red",
                background: "#000",
            }}
        >
            <div
                style={{
                    height: "600px", // Taller than container
                    width: "800px", // Wider than container
                    background: "linear-gradient(45deg, blue, green)",
                    color: "white",
                    padding: "20px",
                }}
            >
                This should definitely show scroll bars!
                <br />
                Height: 600px, Width: 800px
                <br />
                Container: 300px height
            </div>
        </div>
    );
}
