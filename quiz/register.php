<!-- register.php -->
<?php
include('includes/header.php');
?>
<h2>Register</h2>
<form method="POST" action="process_register.php">
    <label for="email">Email:</label>
    <input type="email" id="email" name="email" required><br>
    <label for="password">Password:</label>
    <input type="password" id="password" name="password" required><br>
    <input type="submit" value="Register">
</form>
<?php include('includes/footer.php'); ?>
