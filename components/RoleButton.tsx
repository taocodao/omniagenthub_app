// components/RoleButton.tsx
import React, { useState } from 'react';
import { LocalizedText } from '../util/LocalizedText';

interface RoleData {
    department: string;
    role: string;
}

interface RoleButtonProps {
    department: string;
    role: string;
    activeRoleButton: string | null;
    isSelected: boolean;
    handleRoleDescriptionClick: (
        event: React.MouseEvent<HTMLButtonElement>,
        roleData: RoleData
    ) => void;
}

const RoleButton: React.FC<RoleButtonProps> = ({
    department,
    role,
    activeRoleButton,
    isSelected,
    handleRoleDescriptionClick,
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const uniqueKey = `${department}:${role}`;
    const isActive = activeRoleButton === uniqueKey;

    const getBackgroundColor = () => {
        if (isActive || isHovered) return 'yellow';
        return 'blue';
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                aria-label={`Description for ${role}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={(e) => handleRoleDescriptionClick(e, { department, role })}
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '24px',
                    height: '24px',
                    backgroundColor: getBackgroundColor(),
                    color: 'white',
                    fontWeight: 'bold',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    zIndex: 10,
                    boxShadow: '3px 1px 1px darkred',
                    transition: 'background-color 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                D
            </button>
            {isHovered && (
                <div
                    style={{
                        position: 'absolute',
                        top: '35px',
                        right: '10px',
                        backgroundColor: 'black',
                        color: 'white',
                        padding: '5px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        zIndex: 100,
                    }}
                >
                    <LocalizedText name="Click the D button to see the detailed persona description" />
                </div>
            )}
        </div>
    );
};

export default RoleButton;
