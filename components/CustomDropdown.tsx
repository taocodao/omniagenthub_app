// components/CustomDropdown.tsx

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import styles from './CustomDropdown.module.css'; // CSS module for styling
import { LocalizedText } from '../util/LocalizedText';

interface CustomDropdownProps {
    label: React.ReactNode; // Changed from string to React.ReactNode
    options: string[];
    selectedOption: string;
    onChange: (option: string) => void;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ label, options, selectedOption, onChange }) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setFocusedIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement | HTMLUListElement | HTMLLIElement>) => {
        if (e.currentTarget === buttonRef.current) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setIsOpen(true);
                setFocusedIndex(0);
            }
        } else if (e.currentTarget instanceof HTMLUListElement || e.currentTarget instanceof HTMLLIElement) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (focusedIndex >= 0 && focusedIndex < options.length) {
                    onChange(options[focusedIndex]);
                    setIsOpen(false);
                    setFocusedIndex(-1);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsOpen(false);
                setFocusedIndex(-1);
            }
        }
    };

    return (
        <div className={styles.dropdown} ref={dropdownRef}>
            <label className={styles.label}>{label}</label>
            <button
                ref={buttonRef}
                className={styles.dropdownButton}
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onKeyDown={handleKeyDown}
            >
                {selectedOption || <LocalizedText name="Select Category" />}
                <span className={styles.arrow}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
                <ul
                    className={styles.dropdownList}
                    role="listbox"
                    aria-activedescendant={focusedIndex >= 0 ? `option-${focusedIndex}` : undefined}
                    tabIndex={-1}
                    onKeyDown={handleKeyDown}
                >
                    {options.map((option, index) => (
                        <li
                            key={option}
                            id={`option-${index}`}
                            role="option"
                            aria-selected={selectedOption === option}
                            className={`${styles.dropdownItem} ${focusedIndex === index ? styles.focused : ''} ${selectedOption === option ? styles.selected : ''}`}
                            onClick={() => {
                                onChange(option);
                                setIsOpen(false);
                                setFocusedIndex(-1);
                            }}
                            onMouseEnter={() => setFocusedIndex(index)}
                            onMouseLeave={() => setFocusedIndex(-1)}
                            tabIndex={0}
                            onKeyDown={handleKeyDown}
                        >
                            <LocalizedText name={option} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default CustomDropdown;
