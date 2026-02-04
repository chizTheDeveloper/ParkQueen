interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  dob: string;
  gender: string;
}

export const saveUser = (user: UserProfile) => {
  console.log("Saving user to the database:", user);
  // Here you would typically make a call to your backend to save the user data.
  // For now, we'll just log it to the console.
};
