import React, { useEffect, useState } from 'react';
import axios from 'axios';

// Define interfaces for our data structures
interface Task {
    id: string;
    title: string;
    description: string;
}

interface Role {
    id: string;
    name: string;
    tasks: Task[];
}

interface Department {
    id: string;
    name: string;
    roles: Role[];
}

const TasksDashboard: React.FC = () => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalTasks, setTotalTasks] = useState(0);

    // API endpoints (matching those in fetchTasksDesc.js)
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

    // Function to fetch departments
    const fetchDepartments = async (): Promise<string[]> => {
        try {
            const response = await axios.post(`${BASE_URL}/get-departments`, {});
            if (response.status === 200) {
                return response.data;
            } else {
                throw new Error(`Failed to fetch departments: ${response.status}`);
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
            throw error;
        }
    };

    // Function to fetch roles for a department
    const fetchRoles = async (department: string): Promise<string[]> => {
        try {
            const response = await axios.post(`${BASE_URL}/get-roles`, { department });
            if (response.status === 200) {
                return response.data.roles || [];
            } else {
                throw new Error(`Failed to fetch roles: ${response.status}`);
            }
        } catch (error) {
            console.error(`Error fetching roles for department "${department}":`, error);
            throw error;
        }
    };

    // Function to fetch tasks for a department and role
    const fetchTasks = async (department: string, role: string): Promise<string[]> => {
        try {
            const response = await axios.post(`${BASE_URL}/get-tasks`, { department, role });
            if (response.status === 200) {
                return response.data.tasks || [];
            } else {
                throw new Error(`Failed to fetch tasks: ${response.status}`);
            }
        } catch (error) {
            console.error(`Error fetching tasks for role "${role}" in department "${department}":`, error);
            throw error;
        }
    };

    // Function to fetch task description
    const fetchTaskDescription = async (department: string, role: string, task: string): Promise<string> => {
        try {
            const response = await axios.post(`${BASE_URL}/get_task_description`, {
                department,
                role,
                task,
                language: 'English',
            });
            if (response.status === 200 && response.data.description) {
                return response.data.description;
            } else {
                throw new Error('Description missing or empty');
            }
        } catch (error) {
            console.error(`Error fetching description for task "${task}":`, error);
            return 'Description not available';
        }
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);

                // Step 1: Fetch all departments
                const deptNames = await fetchDepartments();

                // Prepare data structure
                const deptData: Department[] = [];
                let taskCount = 0;

                // Step 2: For each department, fetch roles
                for (const deptName of deptNames) {
                    const roles = await fetchRoles(deptName);
                    const roleData: Role[] = [];

                    // Step 3: For each role, fetch tasks
                    for (const roleName of roles) {
                        const tasks = await fetchTasks(deptName, roleName);
                        const taskData: Task[] = [];

                        // Step 4: For each task, fetch description
                        for (const taskName of tasks) {
                            const description = await fetchTaskDescription(deptName, roleName, taskName);

                            taskData.push({
                                id: `${deptName}-${roleName}-${taskName}`,
                                title: taskName,
                                description
                            });

                            // Increment task counter
                            taskCount++;
                        }

                        roleData.push({
                            id: `${deptName}-${roleName}`,
                            name: roleName,
                            tasks: taskData
                        });
                    }

                    deptData.push({
                        id: deptName,
                        name: deptName,
                        roles: roleData
                    });
                }

                // Update state with all data
                setDepartments(deptData);
                setTotalTasks(taskCount);
                setLoading(false);
            } catch (err) {
                setError('Failed to load data');
                setLoading(false);
                console.error('Error loading data:', err);
            }
        };

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="loading-container">
                <p>Loading tasks data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <p>Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="tasks-dashboard">
            <h1 className="dashboard-title">Tasks Dashboard</h1>
            <p className="task-count">Total Tasks: {totalTasks}</p>

            {departments.map((dept) => (
                <div key={dept.id} className="department-section">
                    <h2 className="department-name">{dept.name} Department</h2>

                    {dept.roles.map((role) => (
                        <div key={role.id} className="role-section">
                            <h3 className="role-name">{role.name}</h3>

                            {role.tasks.length > 0 ? (
                                <ul className="task-list">
                                    {role.tasks.map((task) => (
                                        <li key={task.id} className="task-item">
                                            <h4 className="task-title">{task.title}</h4>
                                            <p className="task-description">{task.description}</p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="no-tasks">No tasks assigned to this role</p>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default TasksDashboard;
