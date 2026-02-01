import React from 'react';
import { LocalizedText } from '../util/LocalizedText';

interface RoleData {
    department: string;
    role: string;
}

interface RoleItemProps {
    roleData: RoleData;  // Pass the full role object
    handleRoleChange: (roleData: RoleData) => void;  // Accept RoleData object
    handleDescriptionClick?: (event: React.MouseEvent<HTMLButtonElement>, roleData: RoleData) => void;
    selectedRole: RoleData | null;  // Change to RoleData | null
    activeRoleButton: string | null;
}

const RoleItem: React.FC<RoleItemProps> = ({
    roleData,
    handleRoleChange,
    handleDescriptionClick,
    selectedRole,
    activeRoleButton
}) => {
    const isSelected = selectedRole?.role === roleData.role && selectedRole?.department === roleData.department;
    const isActive = activeRoleButton === `${roleData.department}:${roleData.role}`;

    return (
        <div
            style={{
                padding: "0.5rem",
                cursor: "pointer",
                backgroundColor: isSelected ? "rgba(255, 255, 255, 0.2)" : "transparent",
                borderRadius: "4px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                margin: "0.25rem 0"
            }}
            onClick={() => handleRoleChange(roleData)}  // Pass the full roleData object
        >
            <div style={{ flex: 1 }}>
                <LocalizedText name={roleData.role} />
            </div>

            {handleDescriptionClick && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDescriptionClick(e, roleData);
                    }}
                    style={{
                        marginLeft: "0.5rem",
                        padding: "0.25rem 0.5rem",
                        backgroundColor: isActive ? "#0070f3" : "#666",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                    }}
                >
                    ?
                </button>
            )}
        </div>
    );
};

export default RoleItem;
