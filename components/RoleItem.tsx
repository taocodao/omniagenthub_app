// RoleItem.tsx

import React, { useState } from 'react';
import { LocalizedText } from '../util/LocalizedText'; // Adjust the import path accordingly

interface RoleData {
    department: string;
    role: string;
}

interface RoleItemProps {
    role: string;
    department: string;
    handleRoleChange: (roleData: RoleData) => void;
    handleRoleDescriptionClick: (event: React.MouseEvent<HTMLButtonElement>, roleData: RoleData) => void;
    selectedRole: string | null;
    activeRoleButton: string | null;
}

const RoleItem: React.FC<RoleItemProps> = ({
    role,
    department,
    handleRoleChange,
    handleRoleDescriptionClick,
    selectedRole,
    activeRoleButton,
}) => {
    const [isRoleHovered, setIsRoleHovered] = useState(false);
    const [isButtonHovered, setIsButtonHovered] = useState(false);
    const [isTooltipVisible, setIsTooltipVisible] = useState(false); // New state for tooltip

    // Handlers for role hover
    const handleRoleMouseEnter = () => {
        setIsRoleHovered(true);
    };

    const handleRoleMouseLeave = () => {
        setIsRoleHovered(false);
    };

    // Handlers for button hover and tooltip
    const handleButtonMouseEnter = () => {
        setIsTooltipVisible(true);
        setIsButtonHovered(true);
    };

    const handleButtonMouseLeave = () => {
        setIsTooltipVisible(false);
        setIsButtonHovered(false);
    };

    // Determine background color for role
    const getRoleBackgroundColor = () => {
        if (isRoleHovered) {
            return 'deeppink'; // Background turns dark pink on hover
        } else {
            return 'transparent'; // Default background
        }
    };

    // Determine background color for the description button
    const getButtonBackgroundColor = () => {
        const uniqueKey = `${department}:${role}`;
        if (activeRoleButton === uniqueKey || isButtonHovered) {
            return 'yellow'; // Active button turns yellow
        } else {
            return 'blue';
        }
    };

    // Create the combined role data (department + role)
    const roleData = { department, role };

    return (
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <button
                style={{
                    width: '24px',
                    height: '24px',
                    marginRight: '8px',
                    backgroundColor: getButtonBackgroundColor(),
                    color: 'white',
                    fontWeight: 'bold',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    position: 'relative', // Ensure tooltip is positioned relative to button
                    boxShadow: '3px 1px 1px darkred',
                    transition: 'background-color 0.2s',
                }}
                onMouseEnter={handleButtonMouseEnter}
                onMouseLeave={handleButtonMouseLeave}
                onClick={(e) => handleRoleDescriptionClick(e, roleData)}
            >
                D
                {isTooltipVisible && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '-30px', // Position the tooltip above the button
                            left: '50%',
                            transform: 'translateX(-90%)',
                            backgroundColor: '#333',
                            color: '#fff',
                            padding: '5px 10px',
                            borderRadius: '1px',
                            fontSize: '14px',
                            whiteSpace: 'nowrap',
                            zIndex: 1000,
                            pointerEvents: 'none', // Prevents tooltip from capturing mouse events
                            opacity: 0.9,
                        }}
                    >
                        <LocalizedText name="Click to display detail persona description" />
                    </div>
                )}
            </button>

            <p
                style={{
                    fontSize: '17px',
                    padding: '0.25rem 0.50rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid #eee',
                    flex: 1,
                    backgroundColor: getRoleBackgroundColor(),
                    margin: '0.25rem 0', // Adjusted margin to reduce vertical space
                    transition: 'background-color 0.2s',
                }}
                onClick={() => {
                    console.log('🔵 [RoleItem] Clicked role:', roleData);
                    handleRoleChange(roleData);
                }}
                onMouseEnter={handleRoleMouseEnter}
                onMouseLeave={handleRoleMouseLeave}
            >
                <LocalizedText name={role} />
            </p>
        </div>
    );
};

export default RoleItem;
