<!-- login.php -->
<?php
include('includes/header.php');
?>
<h2>Login</h2>
<form method="POST" action="process_login.php">
    <label for="email">Email:</label>
    <input type="email" id="email" name="email" required><br>
    <label for="password">Password:</label>
    <input type="password" id="password" name="password" required><br>
    <input type="submit" value="Login">
</form>
<?php include('includes/footer.php'); ?>
